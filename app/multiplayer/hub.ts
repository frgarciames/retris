// In-memory 1v1 matchmaking, relay, reconnection, and result persistence.
//
// The app runs as a single Node process and the event loop is single-threaded,
// so the waiting slot and the player table need no locking. Players are keyed by
// a stable `clientId` (kept in the browser's localStorage) so a refresh or a
// dropped connection can reattach to the same match instead of being treated as
// a brand-new player. Each player holds a long-lived SSE connection (a `send`
// callback); they are paired FIFO into a match sharing one seed, and garbage /
// board snapshots / results are relayed between them. Finished matches with at
// least one registered player are written to the database for the leaderboard.
// Not in the asset `allow` list, so it never reaches the browser.

import { db } from "../data/db.ts";
import { createVersusGame } from "../data/versus.ts";
import { randomSeed } from "../game/rng.ts";

type Send = (event: string, data: unknown) => void;

// How long a disconnected player has to reconnect before they forfeit. The
// opponent waits (paused) for this whole window.
const GRACE_MS = 60_000;
const CANCELED_NOTICE_MS = 5 * 60_000;

interface Finish {
  result: "won" | "lost";
  reason?: "surrendered";
  actions: string; // JSON Array<{tick,action}>
  garbage: string; // JSON Array<{tick,holes}>
  lines: number;
}

interface Snapshot {
  board: number[];
  lines: number;
}

export interface Player {
  clientId: string;
  name: string;
  userId: number | null;
  send: Send | null;
  connected: boolean;
  // Identifies the current SSE stream so a stale stream's teardown can't
  // disconnect a player who has already reconnected on a newer stream.
  streamToken: number;
  graceTimer: ReturnType<typeof setTimeout> | null;
  match: Match | null;
  finish: Finish | null;
  lastSnapshot: Snapshot | null;
}

interface Match {
  id: string;
  seed: number;
  a: Player;
  b: Player;
  over: boolean;
  winner: Player | null;
  persisted: boolean;
}

let waiting: Player | null = null;
let tokenSeq = 0;
const players = new Map<string, Player>();
const canceledClients = new Map<string, ReturnType<typeof setTimeout>>();

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function opponentOf(player: Player): Player | null {
  let match = player.match;
  if (!match) return null;
  return match.a.clientId === player.clientId ? match.b : match.a;
}

function markCanceled(clientId: string): void {
  let existing = canceledClients.get(clientId);
  if (existing) clearTimeout(existing);
  let timer = setTimeout(() => canceledClients.delete(clientId), CANCELED_NOTICE_MS);
  (timer as { unref?: () => void }).unref?.();
  canceledClients.set(clientId, timer);
}

function consumeCanceled(clientId: string): boolean {
  let timer = canceledClients.get(clientId);
  if (!timer) return false;
  clearTimeout(timer);
  canceledClients.delete(clientId);
  return true;
}

// Register or reattach a connection. Returns the Player; the caller should read
// `player.streamToken` immediately and pass it back to `disconnectStream` so a
// superseded stream's teardown is ignored.
export function connectPlayer(
  clientId: string,
  name: string,
  userId: number | null,
  send: Send,
): Player {
  let existing = players.get(clientId);
  let canceled = false;

  // Reconnection into a still-live match: swap in the new stream, cancel the
  // grace timer, and resume both sides.
  if (existing && existing.match && !existing.match.over) {
    existing.send = send;
    existing.connected = true;
    existing.name = name || existing.name;
    if (userId != null) existing.userId = userId;
    existing.streamToken = ++tokenSeq;
    if (existing.graceTimer) {
      clearTimeout(existing.graceTimer);
      existing.graceTimer = null;
    }
    send("hello", { reconnected: true });
    let opponent = opponentOf(existing);
    send("resume", {
      seed: existing.match.seed,
      opponent: opponent?.name ?? "Opponent",
      opponentBoard: opponent?.lastSnapshot ?? null,
    });
    opponent?.send?.("opponent_reconnected", {});
    return existing;
  }

  // Otherwise a fresh player (drop any stale lobby record for this clientId).
  if (existing) players.delete(clientId);
  else canceled = consumeCanceled(clientId);
  let player: Player = {
    clientId,
    name: name || "Guest",
    userId: userId ?? null,
    send,
    connected: true,
    streamToken: ++tokenSeq,
    graceTimer: null,
    match: null,
    finish: null,
    lastSnapshot: null,
  };
  players.set(clientId, player);
  send("hello", { reconnected: false, canceled });

  // Pair with whoever is waiting — but never a stale or self slot.
  if (
    waiting &&
    waiting.clientId !== clientId &&
    waiting.connected &&
    players.get(waiting.clientId) === waiting
  ) {
    let opponent = waiting;
    waiting = null;
    let match: Match = {
      id: newId(),
      seed: randomSeed(),
      a: opponent,
      b: player,
      over: false,
      winner: null,
      persisted: false,
    };
    opponent.match = match;
    player.match = match;
    opponent.send?.("start", { seed: match.seed, opponent: player.name });
    send("start", { seed: match.seed, opponent: opponent.name });
  } else {
    waiting = player;
    send("waiting", { canceled });
  }
  return player;
}

// Relay a board snapshot to the opponent (the mirror), plus any garbage the
// player just sent by clearing lines. The snapshot is retained so a reconnecting
// opponent can be handed the current board.
export function relayUpdate(
  clientId: string,
  payload: { board: number[]; lines: number; status: string; sent: number },
): void {
  let player = players.get(clientId);
  if (!player) return;
  player.lastSnapshot = { board: payload.board, lines: payload.lines };
  let opponent = opponentOf(player);
  if (!opponent || !opponent.send) return;
  if (payload.sent > 0) opponent.send("garbage", { count: payload.sent });
  opponent.send("opponent", {
    board: payload.board,
    lines: payload.lines,
    status: payload.status,
  });
}

// A player's game ended ('won' reached the goal, 'lost' topped out), carrying
// their full recording. Resolves the match on the first report and persists once
// both recordings (or a forfeit) are in.
export function reportFinish(clientId: string, finish: Finish): void {
  let player = players.get(clientId);
  if (!player) return;
  let match = player.match;
  if (!match) return;
  player.finish = finish;

  if (!match.over) {
    match.over = true;
    let opponent = opponentOf(player);
    match.winner = finish.result === "won" ? player : (opponent ?? player);
    if (opponent?.send) {
      opponent.send(finish.result === "won" ? "lose" : "win", { reason: finish.reason });
    }
    clearGrace(match.a);
    clearGrace(match.b);
  }
  tryPersist(match);
}

// The player's stream closed. If they were mid-match, hold the match open for a
// grace period and let the opponent know to wait; only forfeit if they never
// return. `token` guards against a superseded stream tearing down a player who
// already reconnected.
export function disconnectStream(clientId: string, token: number): void {
  let player = players.get(clientId);
  if (!player || player.streamToken !== token) return;
  player.connected = false;
  player.send = null;

  if (waiting && waiting.clientId === clientId) {
    waiting = null;
    players.delete(clientId);
    return;
  }

  let match = player.match;
  if (!match || match.over) return;

  let opponent = opponentOf(player);
  if (opponent && !opponent.connected) {
    cancelMatch(match);
    return;
  }

  opponent?.send?.("opponent_disconnected", {});
  if (player.graceTimer) clearTimeout(player.graceTimer);
  player.graceTimer = setTimeout(() => forfeit(player), GRACE_MS);
  // A pending forfeit must not keep the process alive on shutdown.
  (player.graceTimer as { unref?: () => void }).unref?.();
}

function forfeit(player: Player): void {
  player.graceTimer = null;
  let match = player.match;
  if (!match || match.over || player.connected) return;
  let opponent = opponentOf(player);
  match.over = true;
  match.winner = opponent ?? null;
  opponent?.send?.("opponent_left", {});
  tryPersist(match);
}

function cancelMatch(match: Match): void {
  match.over = true;
  match.winner = null;
  match.persisted = true;
  markCanceled(match.a.clientId);
  markCanceled(match.b.clientId);
  cleanup(match);
}

function clearGrace(player: Player): void {
  if (player.graceTimer) {
    clearTimeout(player.graceTimer);
    player.graceTimer = null;
  }
}

function tryPersist(match: Match): void {
  if (match.persisted || !match.winner) return;
  let winner = match.winner;
  let loser = winner.clientId === match.a.clientId ? match.b : match.a;
  let wf = winner.finish;
  if (!wf) return; // wait for the winner's recording before storing

  match.persisted = true;
  cleanup(match);

  // Only matches with a registered player belong on the leaderboard.
  if (winner.userId == null && loser.userId == null) return;

  let lf = loser.finish;
  createVersusGame(db, {
    winner_user_id: winner.userId,
    loser_user_id: loser.userId,
    winner_name: winner.name,
    loser_name: loser.name,
    seed: match.seed,
    winner_actions: wf.actions,
    winner_garbage: wf.garbage,
    winner_lines: wf.lines,
    loser_actions: lf?.actions ?? "[]",
    loser_garbage: lf?.garbage ?? "[]",
    loser_lines: lf?.lines ?? 0,
  }).catch((error) => console.error("versus persist failed:", error));
}

function cleanup(match: Match): void {
  for (let player of [match.a, match.b]) {
    clearGrace(player);
    if (players.get(player.clientId) === player) players.delete(player.clientId);
  }
}

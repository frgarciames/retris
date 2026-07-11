import { Database } from "remix/data-table";
import { Auth } from "remix/middleware/auth";
import { createController } from "remix/router";

import { getVersusGame } from "../../data/versus.ts";
import { VERSUS_MODE } from "../../game/modes.ts";
import { readTheme } from "../../middleware/theme.ts";
import {
  connectPlayer,
  disconnectStream,
  relayUpdate,
  reportFinish,
} from "../../multiplayer/hub.ts";
import { routes } from "../../routes.ts";
import { VersusPage } from "../../ui/versus-page.tsx";
import { VersusReplayPage } from "./replay-page.tsx";

// Cap a recording payload so a finished-match POST can't be abused into a huge
// row. A long 40-line match is well under this.
const MAX_RECORDING = 1_500_000;

const noContent = () => new Response(null, { status: 204 });

export default createController(routes.versus, {
  actions: {
    // GET /1vs1 — the multiplayer page hosting the live board client entry.
    async index(context) {
      let auth = context.get(Auth);
      let user = auth.ok ? { username: auth.identity.username } : null;
      let theme = await readTheme(context.request);
      return context.render(<VersusPage user={user} theme={theme} mode={VERSUS_MODE} />);
    },

    // GET /1vs1/events?clientId=… — Server-Sent Events stream, held open for the
    // life of the connection. The stable clientId lets a refresh or a dropped
    // connection reattach to the same match instead of starting over.
    async events(context) {
      let clientId = context.url.searchParams.get("clientId");
      if (!clientId) return new Response("Missing clientId", { status: 400 });

      let auth = context.get(Auth);
      let name = auth.ok ? auth.identity.username : "Guest";
      let userId = auth.ok ? auth.identity.id : null;

      let encoder = new TextEncoder();
      let token = 0;
      let closed = false;
      let ping: ReturnType<typeof setInterval> | undefined;
      let teardown = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        disconnectStream(clientId!, token);
      };

      let stream = new ReadableStream({
        start(controller) {
          let send = (event: string, data: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            } catch {
              closed = true;
            }
          };
          let player = connectPlayer(clientId!, name, userId, send);
          token = player.streamToken;
          // Comment-only keepalive so idle proxies don't drop the connection.
          ping = setInterval(() => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`: ping\n\n`));
            } catch {
              closed = true;
            }
          }, 20_000);
          context.request.signal.addEventListener("abort", () => {
            teardown();
            try {
              controller.close();
            } catch {
              // already closed
            }
          });
        },
        cancel() {
          teardown();
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    },

    // POST /1vs1/update — one endpoint for everything a client pushes during a
    // match: a `result` (won/lost) carries the player's full recording and
    // resolves the match; otherwise a board snapshot plus any `sent` garbage is
    // forwarded to the opponent.
    async update(context) {
      let form = context.get(FormData);
      let clientId = String(form.get("clientId") ?? "");
      if (!clientId) return noContent();

      let result = String(form.get("result") ?? "");
      if (result === "won" || result === "lost") {
        let actions = String(form.get("actions") ?? "[]");
        let garbage = String(form.get("garbage") ?? "[]");
        if (actions.length > MAX_RECORDING) actions = "[]";
        if (garbage.length > MAX_RECORDING) garbage = "[]";
        let lines = Number(form.get("lines") ?? 0);
        let reason = String(form.get("reason") ?? "");
        reportFinish(clientId, {
          result,
          reason: reason === "surrendered" ? "surrendered" : undefined,
          actions,
          garbage,
          lines: Number.isFinite(lines) ? lines : 0,
        });
        return noContent();
      }

      let board: number[] = [];
      let raw = form.get("board");
      if (typeof raw === "string") {
        try {
          let parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) board = parsed;
        } catch {
          // ignore a malformed snapshot — the next frame sends a fresh one
        }
      }
      let sent = Number(form.get("sent") ?? 0);
      relayUpdate(clientId, {
        board,
        lines: Number(form.get("lines") ?? 0),
        status: String(form.get("status") ?? "playing"),
        sent: Number.isFinite(sent) ? sent : 0,
      });
      return noContent();
    },

    // GET /1vs1/games/:id — replay a stored match, both boards side by side.
    async show(context) {
      let id = Number(context.params.id);
      if (!Number.isInteger(id)) return new Response("Not Found", { status: 404 });

      let db = context.get(Database);
      let game = await getVersusGame(db, id);
      if (!game) return new Response("Not Found", { status: 404 });

      let auth = context.get(Auth);
      let viewer = auth.ok ? { username: auth.identity.username } : null;
      let theme = await readTheme(context.request);
      return context.render(<VersusReplayPage game={game} viewer={viewer} theme={theme} />);
    },
  },
});

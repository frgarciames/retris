import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { db } from "./db.ts";
import { createUser } from "./users.ts";
import { createVersusGame, versusLeaderboard, type NewVersusGame } from "./versus.ts";

// Builds a finished-match row; user ids are nullable so a guest side is null.
function matchRow(
  winnerId: number | null,
  loserId: number | null,
  winnerName: string,
  loserName: string,
): NewVersusGame {
  return {
    winner_user_id: winnerId,
    loser_user_id: loserId,
    winner_name: winnerName,
    loser_name: loserName,
    seed: 1,
    winner_actions: "[]",
    winner_garbage: "[]",
    winner_lines: 40,
    loser_actions: "[]",
    loser_garbage: "[]",
    loser_lines: 5,
  };
}

describe("versus leaderboard sorting", () => {
  it("ranks by win rate by default and by total wins on demand", async () => {
    let unique = Date.now();
    let highRate = await createUser(
      db,
      `avgchamp_${unique}`,
      `avgchamp_${unique}@example.test`,
      "password",
    );
    let manyWins = await createUser(
      db,
      `winschamp_${unique}`,
      `winschamp_${unique}@example.test`,
      "password",
    );
    assert.ok(highRate.ok && manyWins.ok);
    let highId = highRate.user.id;
    let manyId = manyWins.user.id;

    // highRate: 1 win / 1 game = 100%.
    await createVersusGame(db, matchRow(highId, null, "avgchamp", "guest"));
    // manyWins: 3 wins / 6 games = 50%.
    for (let i = 0; i < 3; i++) {
      await createVersusGame(db, matchRow(manyId, null, "winschamp", "guest"));
      await createVersusGame(db, matchRow(null, manyId, "guest", "winschamp"));
    }

    let byAvg = await versusLeaderboard(db, "avg");
    let byWins = await versusLeaderboard(db, "wins");
    let mine = (s: { user_id: number }) => s.user_id === highId || s.user_id === manyId;

    // Win rate puts the 100% player first; total wins puts the 3-win player first.
    assert.equal(byAvg.filter(mine)[0]!.user_id, highId);
    assert.equal(byWins.filter(mine)[0]!.user_id, manyId);

    // Tallies are correct regardless of sort.
    let high = byAvg.find((s) => s.user_id === highId)!;
    let many = byAvg.find((s) => s.user_id === manyId)!;
    assert.equal(high.wins, 1);
    assert.equal(high.winRate, 100);
    assert.equal(many.wins, 3);
    assert.equal(many.games, 6);
    assert.equal(many.winRate, 50);
  });

  it("supports ascending order for the chosen sort column", async () => {
    let unique = Date.now() + 1;
    let highRate = await createUser(
      db,
      `avgasc_${unique}`,
      `avgasc_${unique}@example.test`,
      "password",
    );
    let manyWins = await createUser(
      db,
      `winsasc_${unique}`,
      `winsasc_${unique}@example.test`,
      "password",
    );
    assert.ok(highRate.ok && manyWins.ok);
    let highId = highRate.user.id;
    let manyId = manyWins.user.id;

    // highRate: 1 win / 1 game = 100%.
    await createVersusGame(db, matchRow(highId, null, "avgasc", "guest"));
    // manyWins: 3 wins / 6 games = 50%.
    for (let i = 0; i < 3; i++) {
      await createVersusGame(db, matchRow(manyId, null, "winsasc", "guest"));
      await createVersusGame(db, matchRow(null, manyId, "guest", "winsasc"));
    }

    let byAvgAsc = await versusLeaderboard(db, "avg", "asc");
    let byWinsAsc = await versusLeaderboard(db, "wins", "asc");
    let mine = (s: { user_id: number }) => s.user_id === highId || s.user_id === manyId;

    // Ascending flips each ranking: lower rate first, then fewer wins first.
    assert.equal(byAvgAsc.filter(mine)[0]!.user_id, manyId);
    assert.equal(byWinsAsc.filter(mine)[0]!.user_id, highId);
  });
});

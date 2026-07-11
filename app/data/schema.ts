import { column as c, table } from "remix/data-table";
import type { TableRow } from "remix/data-table";

// Schema definitions describe what the app reads and writes. The SQL migrations
// under db/migrations/ own the actual DDL and constraints; the modifiers here
// mirror those constraints so the table defs stay useful as schema-level docs.

export const users = table({
  name: "users",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    username: c.text().notNull().unique(),
    email: c.text().unique().nullable(),
    password_hash: c.text().notNull(),
    created_at: c.integer().notNull(),
  },
});

export const passwordResetTokens = table({
  name: "password_reset_tokens",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c.integer().notNull().references("users", "id"),
    token_hash: c.text().notNull().unique(),
    expires_at: c.integer().notNull(),
    created_at: c.integer().notNull(),
  },
});

export const games = table({
  name: "games",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c.integer().notNull().references("users", "id"),
    // Game mode identifier (e.g. "sprint40"). Stored per run so new modes can be
    // added later without migrating existing rows.
    mode: c.text().notNull(),
    // Seed for the deterministic PRNG that drives piece generation.
    seed: c.integer().notNull(),
    // Goal that ended the run (line count for line goals). Denormalized for the
    // leaderboard so it does not need to re-read the mode registry.
    lines_goal: c.integer().notNull(),
    // Server-verified results, recomputed from the replay on submit.
    duration_ms: c.integer().notNull(),
    // Classic mode: level reached at top-out. Sprint modes store 0.
    level: c.integer().notNull().default(0),
    lines_cleared: c.integer().notNull(),
    // Recorded inputs as JSON: Array<{ tick: number; action: string }>.
    actions: c.text().notNull(),
    created_at: c.integer().notNull(),
  },
});

// Completed 1v1 matches. Both players' recordings are stored against the shared
// seed so the match can be replayed board-for-board. User ids are nullable: a
// guest can play, but only registered players appear on the 1v1 leaderboard.
export const versusGames = table({
  name: "versus_games",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    winner_user_id: c.integer().references("users", "id").nullable(),
    loser_user_id: c.integer().references("users", "id").nullable(),
    winner_name: c.text().notNull(),
    loser_name: c.text().notNull(),
    // Shared PRNG seed (both boards draw the same piece sequence).
    seed: c.integer().notNull(),
    // Recorded inputs (JSON Array<{tick,action}>) and received garbage
    // (JSON Array<{tick,holes:number[]}>) per side.
    winner_actions: c.text().notNull(),
    winner_garbage: c.text().notNull(),
    winner_lines: c.integer().notNull(),
    loser_actions: c.text().notNull(),
    loser_garbage: c.text().notNull(),
    loser_lines: c.integer().notNull(),
    created_at: c.integer().notNull(),
  },
});

export type User = TableRow<typeof users>;
export type PasswordResetToken = TableRow<typeof passwordResetTokens>;
export type Game = TableRow<typeof games>;
export type VersusGame = TableRow<typeof versusGames>;

import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";

import Libsql from "libsql";
import { createDatabase } from "remix/data-table";
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";
import { createSqliteDatabaseAdapter, type SqliteDatabase } from "remix/data-table/sqlite";

const rootDir = process.cwd();

// How often the embedded replica pulls changes from the Turso primary. Writes
// made through this process are visible locally right away (read-your-writes);
// the interval only bounds how stale *other* writers' changes can be.
const REPLICA_SYNC_INTERVAL_MS = 10_000;

// Three backends, all through the same synchronous sqlite adapter:
// - tests: isolated in-memory database, never touches real state
// - TURSO_DATABASE_URL set (production, see .env): an embedded libSQL replica —
//   a local file synced from the Turso primary, so reads are local instead of
//   a ~200ms blocking network round-trip per query; writes are delegated to
//   the primary
// - otherwise: the local db/retris.sqlite file
function openSqlite(): SqliteDatabase {
  if (process.env.NODE_ENV === "test") {
    let sqlite = new DatabaseSync(":memory:");
    sqlite.exec("pragma foreign_keys = ON");
    return sqlite;
  }

  let tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    // The package's bundled .d.ts predates remote support and lacks authToken,
    // but the runtime accepts it (see node_modules/libsql/README.md).
    let options = {
      syncUrl: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    } as Libsql.Options;
    let replica = new Libsql(path.join(rootDir, "db", "replica.sqlite"), options);
    replica.sync();
    let timer = setInterval(() => {
      try {
        replica.sync();
      } catch (error) {
        console.error("Turso replica sync failed:", error);
      }
    }, REPLICA_SYNC_INTERVAL_MS);
    // A periodic sync must not keep the process alive on shutdown.
    timer.unref();
    replica.exec("pragma foreign_keys = ON");
    return replica;
  }

  let sqlite = new DatabaseSync(path.join(rootDir, "db", "retris.sqlite"));
  sqlite.exec("pragma foreign_keys = ON");
  // WAL lets reads proceed while a write is in flight. It persists in the
  // database file, but setting it on every connection keeps it guaranteed.
  sqlite.exec("pragma journal_mode = WAL");
  return sqlite;
}

const sqlite = openSqlite();

const adapter = createSqliteDatabaseAdapter(sqlite);

export const db = createDatabase(adapter);

// Apply any pending migrations. Runs once at module load; the runner tracks
// applied migrations in its journal table so this is idempotent across restarts.
export async function migrate(): Promise<void> {
  let migrations = await loadMigrations(path.join(rootDir, "db", "migrations"));
  let runner = createMigrationRunner(adapter, migrations);
  await runner.up();
}

await migrate();

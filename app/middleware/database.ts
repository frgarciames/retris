import { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { db } from "../data/db.ts";

// Exposes the shared database to controllers via `get(Database)`. The
// `{ key, value }` transform tells the router this middleware provides the
// Database context value, so `get(Database)` is typed as non-optional.
export function loadDatabase(): Middleware<{ key: typeof Database; value: Database }> {
  return (context, next) => {
    context.set(Database, db);
    return next();
  };
}

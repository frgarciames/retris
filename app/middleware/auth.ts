import { Database } from "remix/data-table";
import { auth } from "remix/middleware/auth";

import { findById } from "../data/users.ts";
import type { User } from "../data/schema.ts";
import { createSessionAuthScheme } from "remix/middleware/auth";
import type { SessionAuth } from "./session.ts";

// Resolves the logged-in user from the session into `get(Auth)`.
export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, SessionAuth>({
        read(session) {
          return (session.get("auth") as SessionAuth | undefined) ?? null;
        },
        async verify(value, context) {
          let db = context.get(Database);
          if (!db) return null;
          return await findById(db, value.userId);
        },
        invalidate(session) {
          session.unset("auth");
        },
      }),
    ],
  });
}

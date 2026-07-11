import { Database, DataTableConstraintError } from "remix/data-table";

import { hashPassword } from "../utils/passwords.ts";
import { users, type User } from "./schema.ts";

type Db = InstanceType<typeof Database>;

export function findByUsername(db: Db, username: string): Promise<User | null> {
  return db.findOne(users, { where: { username } });
}

export function findByEmail(db: Db, email: string): Promise<User | null> {
  return db.findOne(users, { where: { email } });
}

export function findById(db: Db, id: number): Promise<User | null> {
  return db.find(users, id);
}

export type CreateUserResult =
  | { ok: true; user: User }
  | { ok: false; reason: "username_taken" | "email_taken" };

// Creates a user with a hashed password. Duplicate username or email are
// expected outcomes (the signup form re-renders with an error).
export async function createUser(
  db: Db,
  username: string,
  email: string,
  password: string,
): Promise<CreateUserResult> {
  if (await findByUsername(db, username)) return { ok: false, reason: "username_taken" };
  if (await findByEmail(db, email)) return { ok: false, reason: "email_taken" };

  let password_hash = await hashPassword(password);
  try {
    let result = await db.create(users, {
      username,
      email,
      password_hash,
      created_at: Date.now(),
    });
    let user = await db.find(users, result.insertId as number);
    return { ok: true, user: user! };
  } catch (error) {
    if (error instanceof DataTableConstraintError) {
      return { ok: false, reason: "username_taken" };
    }
    throw error;
  }
}

export async function updatePassword(db: Db, userId: number, password: string): Promise<void> {
  let password_hash = await hashPassword(password);
  // updateMany avoids the `RETURNING *` clause that `db.update` appends: the
  // libSQL embedded replica cannot delegate row-returning writes to the Turso
  // primary (they fail with a Hrana stream error), and the row is unused here.
  await db.updateMany(users, { password_hash }, { where: { id: userId } });
}

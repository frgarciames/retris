import { Database, DataTableConstraintError } from 'remix/data-table'

import { hashPassword } from '../utils/passwords.ts'
import { users, type User } from './schema.ts'

type Db = InstanceType<typeof Database>

export function findByUsername(db: Db, username: string): Promise<User | null> {
  return db.findOne(users, { where: { username } })
}

export function findById(db: Db, id: number): Promise<User | null> {
  return db.find(users, id)
}

export type CreateUserResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'taken' }

// Creates a user with a hashed password. A duplicate username is an expected
// outcome (the signup form re-renders with an error), so it is returned rather
// than thrown.
export async function createUser(
  db: Db,
  username: string,
  password: string,
): Promise<CreateUserResult> {
  let existing = await findByUsername(db, username)
  if (existing) return { ok: false, reason: 'taken' }

  let password_hash = await hashPassword(password)
  try {
    let result = await db.create(users, {
      username,
      password_hash,
      created_at: Date.now(),
    })
    let user = await db.find(users, result.insertId as number)
    return { ok: true, user: user! }
  } catch (error) {
    if (error instanceof DataTableConstraintError) return { ok: false, reason: 'taken' }
    throw error
  }
}

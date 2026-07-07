import { createHash, randomBytes } from 'node:crypto'

import { Database } from 'remix/data-table'

import { passwordResetTokens } from './schema.ts'

type Db = InstanceType<typeof Database>

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function deleteTokensForUser(db: Db, userId: number): Promise<void> {
  await db.deleteMany(passwordResetTokens, { where: { user_id: userId } })
}

// Issues a single-use reset token. Previous tokens for the user are removed.
export async function createResetToken(db: Db, userId: number): Promise<string> {
  await deleteTokensForUser(db, userId)
  let raw = randomBytes(32).toString('base64url')
  let now = Date.now()
  await db.create(passwordResetTokens, {
    user_id: userId,
    token_hash: hashToken(raw),
    expires_at: now + TOKEN_TTL_MS,
    created_at: now,
  })
  return raw
}

export async function peekResetToken(db: Db, rawToken: string): Promise<number | null> {
  let row = await db.findOne(passwordResetTokens, { where: { token_hash: hashToken(rawToken) } })
  if (!row || row.expires_at <= Date.now()) return null
  return row.user_id
}

// Validates and consumes a reset token, returning the user id on success.
export async function consumeResetToken(db: Db, rawToken: string): Promise<number | null> {
  let row = await db.findOne(passwordResetTokens, { where: { token_hash: hashToken(rawToken) } })
  if (!row || row.expires_at <= Date.now()) return null
  await db.delete(passwordResetTokens, row.id)
  return row.user_id
}

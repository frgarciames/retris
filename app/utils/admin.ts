const isProd = process.env.NODE_ENV === 'production'

export const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME?.trim() || (isProd ? '' : 'admin@example.test')

if (!ADMIN_USERNAME && isProd) {
  console.warn('ADMIN_USERNAME is not set — the admin view is disabled.')
}

export function isAdmin(user: { username: string } | null | undefined): boolean {
  if (!ADMIN_USERNAME) return false
  return user?.username === ADMIN_USERNAME
}

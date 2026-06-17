// Only allow redirects to local, same-origin paths to prevent open-redirects.
// A safe value starts with a single "/" and is not protocol-relative ("//").
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

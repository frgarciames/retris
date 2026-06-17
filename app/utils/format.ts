// Formats a duration in milliseconds as m:ss.mmm (e.g. "1:23.456"), the
// conventional sprint-time display. Shared by the game, replay, and leaderboard.
export function formatTime(ms: number): string {
  let totalMs = Math.max(0, Math.round(ms))
  let minutes = Math.floor(totalMs / 60000)
  let seconds = Math.floor((totalMs % 60000) / 1000)
  let millis = totalMs % 1000
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

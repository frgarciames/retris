// Formats a duration in milliseconds as m:ss.mmm (e.g. "1:23.456"), the
// conventional sprint-time display. Shared by the game, replay, and leaderboard.
export function formatTime(ms: number): string {
  let totalMs = Math.max(0, Math.round(ms))
  let minutes = Math.floor(totalMs / 60000)
  let seconds = Math.floor((totalMs % 60000) / 1000)
  let millis = totalMs % 1000
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

// Human-readable duration for classic leaderboard and finish overlays.
export function formatDurationLong(ms: number): string {
  let totalSeconds = Math.max(0, Math.floor(Math.round(ms) / 1000))
  let hours = Math.floor(totalSeconds / 3600)
  let minutes = Math.floor((totalSeconds % 3600) / 60)
  let seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function formatClassicScore(level: number, durationMs: number): string {
  return `${level} / ${formatDurationLong(durationMs)}`
}

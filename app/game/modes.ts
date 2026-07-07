// Game-mode registry. The engine reads a mode's `goal` generically, so adding a
// new mode later (marathon, time attack, ...) is a registry entry here rather
// than an engine change.

export interface LinesGoal {
  type: 'lines'
  count: number
}

export interface SurvivalGoal {
  type: 'survival'
}

export type Goal = LinesGoal | SurvivalGoal

export interface SpeedProfile {
  // Lines cleared per level step (level 1 at start).
  linesPerLevel: number
  // Gravity interval in ticks per level (index 0 = level 1).
  gravityTicks: readonly number[]
}

export interface GameMode {
  id: string
  label: string
  goal: Goal
  speed?: SpeedProfile
  // Live 1v1 matches: excluded from the leaderboard and the single-player mode
  // switcher, since results are unverified and ephemeral.
  versus?: boolean
}

// Classic NES-style gravity curve (ticks at 60 Hz). Level rises every 10 lines.
const CLASSIC_GRAVITY_TICKS = [
  48, 43, 38, 33, 28, 23, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2,
] as const

export const MODES: Record<string, GameMode> = {
  sprint40: {
    id: 'sprint40',
    label: '40 Lines',
    goal: { type: 'lines', count: 40 },
  },
  sprint20: {
    id: 'sprint20',
    label: '20 Lines',
    goal: { type: 'lines', count: 20 },
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    goal: { type: 'survival' },
    speed: { linesPerLevel: 10, gravityTicks: CLASSIC_GRAVITY_TICKS },
  },
  // First to clear 40 lines — or last board standing — wins. Garbage attacks
  // make the race a fight; see the engine's garbage handling.
  versus: {
    id: 'versus',
    label: '1vs1',
    goal: { type: 'lines', count: 40 },
    versus: true,
  },
}

export const DEFAULT_MODE = 'sprint20'
export const VERSUS_MODE = 'versus'

export function getMode(id: string): GameMode | undefined {
  return MODES[id]
}

export function isValidMode(id: string): boolean {
  return id in MODES
}

export function isSurvivalMode(mode: GameMode): boolean {
  return mode.goal.type === 'survival'
}

export type RankingKind = 'time' | 'levelTime'

export function rankingKind(mode: GameMode): RankingKind {
  return mode.goal.type === 'survival' ? 'levelTime' : 'time'
}

// Modes offered for solo play and ranked on the leaderboard.
export function singlePlayerModes(): GameMode[] {
  return Object.values(MODES).filter((mode) => !mode.versus)
}

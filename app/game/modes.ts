// Game-mode registry. The engine reads a mode's `goal` generically, so adding a
// new mode later (marathon, time attack, ...) is a registry entry here rather
// than an engine change. Today there is one mode: the 40-line sprint.

export interface LinesGoal {
  type: 'lines'
  count: number
}

// Future goal kinds (e.g. { type: 'time'; seconds: number }) union in here.
export type Goal = LinesGoal

export interface GameMode {
  id: string
  label: string
  goal: Goal
  // Live 1v1 matches: excluded from the leaderboard and the single-player mode
  // switcher, since results are unverified and ephemeral.
  versus?: boolean
}

export const MODES: Record<string, GameMode> = {
  //sprint40: {
  //  id: 'sprint40',
  //  label: '40 Lines',
  //  goal: { type: 'lines', count: 40 },
  //},
  sprint20: {
    id: 'sprint20',
    label: '20 Lines',
    goal: { type: 'lines', count: 20 },
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

// Modes offered for solo play and ranked on the leaderboard.
export function singlePlayerModes(): GameMode[] {
  return Object.values(MODES).filter((mode) => !mode.versus)
}

// Tetromino definitions using the Super Rotation System (SRS).
//
// Each piece has four rotation states (0 = spawn, 1 = clockwise, 2 = 180,
// 3 = counter-clockwise). A state is the list of filled [col, row] cells within
// the piece's bounding box, with row increasing downward.
//
// Wall-kick tables resolve rotations that would otherwise collide by trying a
// short list of offsets. The canonical SRS tables are written with y pointing
// up; we negate the y component here so they match our downward-row board.

export type PieceType = 0 | 1 | 2 | 3 | 4 | 5 | 6 // I O T S Z J L
export type Rotation = 0 | 1 | 2 | 3
export type Cell = readonly [number, number]

export const PIECE_COUNT = 7

// Visual identity. Index 0 of the board means "empty"; a settled cell stores
// PieceType + 1, so colors are indexed by that stored value.
export const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const
export const PIECE_COLORS: Record<PieceType, string> = {
  0: '#2dd4ee', // I - cyan
  1: '#f5d23a', // O - yellow
  2: '#b14cf0', // T - purple
  3: '#4fe06b', // S - green
  4: '#ff5148', // Z - red
  5: '#3b82f6', // J - blue
  6: '#ff9f2d', // L - orange
}

// Rotation states per piece: ROTATIONS[type][rotation] = Cell[]
export const ROTATIONS: Record<PieceType, readonly Cell[][]> = {
  // I
  0: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  // O
  1: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  // T
  2: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // S
  3: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // Z
  4: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  // J
  5: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  // L
  6: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
}

// Kick tables keyed by "from>to". Offsets already converted to downward-row
// coordinates (y negated from the standard y-up SRS tables).
type KickTable = Record<string, readonly Cell[]>

const JLSTZ_KICKS: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}

const I_KICKS: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}

const NO_KICKS: readonly Cell[] = [[0, 0]]

export function kicksFor(type: PieceType, from: Rotation, to: Rotation): readonly Cell[] {
  if (type === 1) return NO_KICKS // O never needs to kick
  let table = type === 0 ? I_KICKS : JLSTZ_KICKS
  return table[`${from}>${to}`] ?? NO_KICKS
}

export function cellsFor(type: PieceType, rotation: Rotation): readonly Cell[] {
  return ROTATIONS[type][rotation]!
}

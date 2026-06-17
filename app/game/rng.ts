// Deterministic PRNG (mulberry32). The full game is reproducible from a single
// 32-bit seed, which is what makes compact replays and server-side verification
// possible. Same seed + same inputs always yields the same outcome.

export interface Rng {
  next(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

// A 7-bag: a shuffled permutation of the seven tetromino ids. Refilling the
// next-queue one bag at a time guarantees fair, guideline-style piece order.
export function makeBag(rng: Rng): number[] {
  let bag = [0, 1, 2, 3, 4, 5, 6]
  for (let i = bag.length - 1; i > 0; i--) {
    let j = Math.floor(rng.next() * (i + 1))
    let tmp = bag[i]!
    bag[i] = bag[j]!
    bag[j] = tmp
  }
  return bag
}

// A random 32-bit seed for starting a fresh game.
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0
}

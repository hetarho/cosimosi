import type { DemoDiary, DemoDiarySet } from './diary-set.ts'

// The unit of ENTRY randomness is the SET, never a diary ([Z4]) — three diaries drawn independently
// would share no neuron. The draw itself is a parameter, which is what makes the package
// deterministic under test and leaves `Math.random()` at the page boundary ([Z5]).
//
// Total over [0, 1) by construction: the pool is a non-empty tuple, and a draw outside the unit
// interval (or NaN) clamps rather than indexing past the end.
export function pickDemoDiarySet<T>(sets: readonly [T, ...T[]], draw01: number): T {
  const bounded = Number.isFinite(draw01) ? Math.min(Math.max(draw01, 0), 1) : 0
  const index = Math.min(sets.length - 1, Math.floor(bounded * sets.length))
  return sets[index]
}

// The drawn set's per-diary pool, in one canonical order: the tutorial triple first (so the run's
// opening diary is draw 0 and the neuron-reuse beat's draw is the authored second diary, whose
// overlap the fixture was designed around), then the free-play extras.
export function demoDiaryPool(set: DemoDiarySet): readonly [DemoDiary, ...DemoDiary[]] {
  const [first, ...rest] = set.structure.diaries
  return [first, ...rest, ...set.structure.extraDiaries]
}

// The per-diary draw inside a run ([Z4] as amended by change 10): free play keeps writing, one
// prepared diary per press. Deterministic given the draw number and cycling — consecutive draws
// never repeat a diary (the pool is at least four deep), and a visitor who outlasts the pool starts
// over rather than hitting a wall. A negative or non-finite draw number clamps to the pool's start.
export function pickDemoDiary<T>(pool: readonly [T, ...T[]], drawNumber: number): T {
  const bounded = Number.isFinite(drawNumber) ? Math.max(0, Math.floor(drawNumber)) : 0
  return pool[bounded % pool.length]
}

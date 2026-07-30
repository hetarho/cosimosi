// The unit of randomness is the SET, never a diary ([Z4]) — three diaries drawn independently
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

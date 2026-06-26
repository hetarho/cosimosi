/** mulberry32 — 시드 기반 결정론적 PRNG. 같은 시드 → 항상 같은 수열(재현 가능). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

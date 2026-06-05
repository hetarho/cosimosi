// Deterministic star layout — the stand-in placement used by /universe until the
// force-sim coordinate buffer (07) is wired in. Pure math (no three/React/DOM) so the
// star renderer (08 StarField) and the camera fly-to (12) read the SAME formula and
// therefore agree on where each star is. When force-sim coords arrive, both consumers
// switch to that shared buffer instead.
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** Fibonacci-sphere position for star i of n; the radius varies by the star's seed so
 *  stars spread across a shell rather than a single sphere. */
export function fibonacciStarPosition(i: number, n: number, seed: number): [number, number, number] {
  const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0
  const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = GOLDEN * i
  const r = 22 + seed * 24
  return [Math.cos(theta) * rAtY * r, y * r, Math.sin(theta) * rAtY * r]
}

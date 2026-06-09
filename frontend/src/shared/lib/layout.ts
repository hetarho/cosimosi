// Deterministic Fibonacci-sphere star layout. Pure math (no three/React/DOM) so the
// star renderer and the camera fly-to read the SAME formula and agree on each star's position.
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

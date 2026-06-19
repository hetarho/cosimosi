// Pure gesture math (spec 06, change 08) — no React/three/DOM (헌법4), so it unit-tests cleanly and a
// mobile client can reuse it. Deadzone (tap vs drag), double-tap detection, two-pointer centroid /
// spread, thrust ramp, and far-mode pan / zoom-scrub deltas. The canvas gesture controller composes
// these into the lock state machine; the lock logic + Pointer Events live in the ui layer.

export interface Pt {
  x: number
  y: number
}

/** Euclidean distance between two points. */
export function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** True once travel from the press origin reaches the deadzone — promotes a tap to a drag. */
export function passedDeadzone(origin: Pt, now: Pt, deadzonePx: number): boolean {
  return distance(origin, now) >= deadzonePx
}

/** Centroid of one or more points. */
export function centroid(pts: readonly Pt[]): Pt {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  const n = Math.max(1, pts.length)
  return { x: x / n, y: y / n }
}

/** Distance between the first two pointers (0 if fewer than two) — pinch input. */
export function spread(pts: readonly Pt[]): number {
  return pts.length >= 2 ? distance(pts[0], pts[1]) : 0
}

/** Is `now` a double-tap of `prev`? Within `withinMs` AND `maxDistPx`. prev null → false. */
export function isDoubleTap(
  prev: { t: number; pt: Pt } | null,
  now: { t: number; pt: Pt },
  withinMs: number,
  maxDistPx: number,
): boolean {
  if (!prev) return false
  return now.t - prev.t <= withinMs && distance(prev.pt, now.pt) <= maxDistPx
}

/** Thrust from a centroid vertical delta (px, screen coords where +y is DOWN). Below the deadzone →
 *  0; then linear to ±1 at `fullPx`. UP (negative dy) = forward (+1), DOWN = backward (−1). */
export function thrustRamp(dyPx: number, deadzonePx: number, fullPx: number): number {
  const mag = Math.abs(dyPx)
  if (mag <= deadzonePx) return 0
  const ramped = Math.min(1, (mag - deadzonePx) / Math.max(1, fullPx - deadzonePx))
  return dyPx < 0 ? ramped : -ramped
}

/** Far zoom scrub: vertical drag (px, +y DOWN) → radius-change fraction for `r·(1+frac)`. UP
 *  (negative dy) → negative fraction → radius shrinks → zoom IN; DOWN → zoom OUT. Below the
 *  deadzone → 0 (only the travel PAST the deadzone scales, so it starts from rest, no jump). */
export function zoomScrubDelta(dyPx: number, deadzonePx: number, speed: number): number {
  if (Math.abs(dyPx) <= deadzonePx) return 0
  const past = dyPx < 0 ? dyPx + deadzonePx : dyPx - deadzonePx
  return past * speed
}

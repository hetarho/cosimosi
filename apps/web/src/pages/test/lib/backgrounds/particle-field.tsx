import { useEffect, useMemo, useRef, type CSSProperties } from 'react'

import {
  blendEmotionColors,
  hexToRgb,
  rgba,
  type EmotionBackground,
  type EmotionSlice,
} from './emotion-field.ts'

// ── ParticleField ────────────────────────────────────────────────────────────
// Cosmic dust: each emotion becomes a swarm of soft glowing motes drifting through
// the field, additively blended ('lighter') so overlaps bloom into gentle nebulae.
//
// WEIGHT → GEOMETRY (the proportional distribution):
//   The total dust budget (~200 motes) is handed out per emotion IN PROPORTION TO
//   its .weight — count is the proportion. A single emotion at weight 1 owns the
//   whole swarm; thirteen emotions split the budget thirteen ways. Every emotion is
//   guaranteed at least MIN_PER_EMOTION motes via Math.max, so even a 1%-weight
//   emotion still twinkles. Because presence is expressed as *particle count* rather
//   than brightness, the field stays evenly luminous while the mix of colors visibly
//   tracks the emotion shares. Mote size also scales gently with weight (√-ish), so a
//   dominant emotion reads as slightly larger, softer grains.
//
// Motes drift on a slow per-particle velocity and WRAP at the edges (toroidal field),
// so the composition never empties out. All randomness comes from a seeded mulberry32
// PRNG re-created from a FIXED seed at the start of every build, so buildParticles is a
// pure function of the emotion set — the same emotions always yield the same swarm and
// nothing flickers when React re-renders (or re-runs the memo under StrictMode).
//
// REDUCED MOTION: we start no rAF loop and draw exactly ONE static frame with every
// mote at its seeded start position. The still frame already shows the full
// proportional color distribution, so it reads as a complete composition.

const TOTAL_PARTICLES = 200 // dust budget, split across emotions ∝ weight (cap ≤ 220)
const MIN_PER_EMOTION = 4 // floor so tiny-weight emotions still register
const MAX_DPR = 2 // devicePixelRatio cap for performance
const SWARM_SEED = 0x9e3779b9 // fixed seed → deterministic, flicker-free swarm

interface Particle {
  readonly colorIndex: number // index into the resolved emotion color table
  x: number // 0..1 field-space
  y: number // 0..1 field-space
  readonly vx: number // drift velocity (field-fraction per second)
  readonly vy: number
  readonly radius: number // draw radius in field-fraction of the smaller side
  readonly alpha: number // core alpha for this mote
}

/** mulberry32 — tiny deterministic PRNG. Seeded once so the field is stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Allocate the dust budget across emotions ∝ weight (≥ MIN_PER_EMOTION each), then
 * spawn each mote with a seeded position, velocity, radius and alpha. A FRESH PRNG is
 * seeded from a fixed constant on every call, so the result is a pure function of the
 * emotion set — identical across re-renders and StrictMode double-invokes.
 */
function buildParticles(emotions: readonly EmotionSlice[]): Particle[] {
  const particles: Particle[] = []
  if (emotions.length === 0) return particles
  const rand = mulberry32(SWARM_SEED)

  // First pass: floor each emotion at MIN_PER_EMOTION; distribute the remaining
  // budget by weight. This keeps the sum near TOTAL_PARTICLES while honoring shares.
  const floor = MIN_PER_EMOTION * emotions.length
  const remaining = Math.max(0, TOTAL_PARTICLES - floor)
  const counts = emotions.map((emotion) =>
    Math.max(MIN_PER_EMOTION, MIN_PER_EMOTION + Math.round(emotion.weight * remaining)),
  )

  emotions.forEach((emotion, colorIndex) => {
    const count = counts[colorIndex] ?? MIN_PER_EMOTION
    // Larger, softer grains for weightier emotions; clamps keep them ambient.
    const baseRadius = 0.006 + Math.sqrt(emotion.weight) * 0.02
    for (let i = 0; i < count; i += 1) {
      const speed = 0.004 + rand() * 0.012 // slow, cosmic drift
      const angle = rand() * Math.PI * 2
      particles.push({
        colorIndex,
        x: rand(),
        y: rand(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: baseRadius * (0.6 + rand() * 0.9),
        alpha: 0.35 + rand() * 0.4,
      })
    }
  })
  return particles
}

export const ParticleField: EmotionBackground = ({ emotions, reducedMotion, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Deep base fill: weighted blend of the present emotions, darkened toward space so
  // frosted panels stay readable and there are no pure-white blowouts.
  const baseColor = useMemo(() => blendEmotionColors(emotions), [emotions])
  const [br, bg, bb] = useMemo(() => hexToRgb(baseColor), [baseColor])

  // Resolved per-emotion rgb table, indexed by particle.colorIndex.
  const colorTable = useMemo(
    () => emotions.map((emotion) => hexToRgb(emotion.color)),
    [emotions],
  )

  // Rebuild the swarm only when the emotion set changes (never inside the frame loop).
  const particles = useMemo(() => buildParticles(emotions), [emotions])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let width = 1
    let height = 1
    let dpr = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }

    // Draw one full frame at the given elapsed offset (seconds since motes' start).
    // The static (reduced-motion) frame passes elapsed = 0 → seeded start positions.
    const drawFrame = (elapsed: number) => {
      const minSide = Math.min(width, height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Deep base fill — a soft vertical gradient over darkened space so the field
      // reads as a luminous mid-toned backdrop, not a flat wash.
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
      bgGrad.addColorStop(0, `rgb(${Math.round(br * 0.28)}, ${Math.round(bg * 0.28)}, ${Math.round(bb * 0.34)})`)
      bgGrad.addColorStop(1, `rgb(${Math.round(br * 0.14)}, ${Math.round(bg * 0.14)}, ${Math.round(bb * 0.2)})`)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Motes bloom additively so overlaps form gentle nebulae rather than hard dots.
      ctx.globalCompositeOperation = 'lighter'
      for (const p of particles) {
        // Advance by velocity and wrap into 0..1 (toroidal field). Base position is
        // seeded and constant, so this is a pure function of elapsed time.
        const px = (((p.x + p.vx * elapsed) % 1) + 1) % 1
        const py = (((p.y + p.vy * elapsed) % 1) + 1) % 1
        const cx = px * width
        const cy = py * height
        const r = Math.max(1, p.radius * minSide)
        const [cr, cg, cb] = colorTable[p.colorIndex] ?? [br, bg, bb]

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${p.alpha})`)
        grad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${p.alpha * 0.35})`)
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    resize()

    // REDUCED MOTION: single static frame, no rAF loop started at all.
    if (reducedMotion) {
      drawFrame(0)
      // Still observe resize so a static frame stays crisp if the box changes size.
      const staticObserver = new ResizeObserver(() => {
        resize()
        drawFrame(0)
      })
      staticObserver.observe(canvas)
      return () => staticObserver.disconnect()
    }

    let rafId = 0
    let start = 0
    const tick = (now: number) => {
      if (start === 0) start = now
      drawFrame((now - start) / 1000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const observer = new ResizeObserver(() => resize())
    observer.observe(canvas)

    // Full cleanup: cancel the rAF and disconnect the observer — no leaks.
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [particles, colorTable, reducedMotion, br, bg, bb])

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  }

  // Fallback base tint on the root so there is never a bare flash before the canvas
  // paints (also covers the degenerate empty-emotions case).
  const canvasStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    backgroundColor: rgba(baseColor, 0.6),
    display: 'block',
  }

  return (
    <div aria-hidden className={className} style={rootStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  )
}

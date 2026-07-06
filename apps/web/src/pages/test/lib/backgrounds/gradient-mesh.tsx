import { useMemo, type CSSProperties } from 'react'

import {
  blendEmotionColors,
  goldenAnglePlacements,
  rgba,
  type EmotionBackground,
  type EmotionSlice,
} from './emotion-field.ts'

// GradientMesh — one large soft radial-gradient blob per emotion, spread evenly by the golden
// angle so the field divides fairly at any count (1 emotion fills the centre; 13 fan out without
// clustering). The blobs blend in 'screen' over a deep base tint so the backdrop stays mid-toned
// and luminous rather than blowing out to white.
//
// WEIGHT -> GEOMETRY: goldenAnglePlacements gives each slice a centre (x,y) and a radius scaled by
// sqrt(weight), so a blob's diameter tracks sqrt(weight) and its AREA tracks weight linearly. The
// painted presence of an emotion is its area, so each emotion's share of the lit field is exactly
// proportional to its weight. A dominant primary reads as a big soft glow; minor emotions as small
// accents. Because placement is golden-angle, adding emotions re-spreads them evenly instead of
// piling onto one spot.
//
// REDUCED MOTION: the drift is a pure per-blob CSS keyframe animation. When reducedMotion is true we
// simply omit the animation properties, so every blob renders at its exact placement centre — one
// complete, proportional static composition, no rAF loop, no paused animations to babysit.

// Diameter as a fraction of the container's min side. `radius` is already sqrt(weight)-scaled, so
// area stays proportional to weight; this factor sets the overall softness/overlap of the mesh.
const DIAMETER_SCALE = 2.4
// Blur softens each blob into an ambient cloud; scales gently so bigger blobs stay smooth.
const BASE_BLUR_PX = 42
// Per-blob drift durations cycle through this set so neighbouring blobs breathe out of phase.
const DRIFT_DURATIONS = [18, 22, 26, 24, 30, 20, 28]

// Stable fallback for an empty emotions array: one neutral deep-space slice. Hoisted to module
// scope so its reference never changes across renders (keeps the useMemo deps stable) and so its
// `mood` is typed as the exact `Mood` literal the contract requires (uppercase, not 'calm').
const FALLBACK_SLICES: readonly EmotionSlice[] = [
  { mood: 'CALM', color: '#0a0a12', weight: 1 },
]

// Keyframes for the slow breathing drift. Each blob picks one by index so the mesh never pulses in
// unison; `alternate` on the animation makes the translate ease back and forth.
const DRIFT_KEYFRAMES = `
@keyframes gradient-mesh-drift-0 { from { transform: translate(-50%, -50%) translate(0, 0) } to { transform: translate(-50%, -50%) translate(4%, -5%) } }
@keyframes gradient-mesh-drift-1 { from { transform: translate(-50%, -50%) translate(0, 0) } to { transform: translate(-50%, -50%) translate(-5%, 3%) } }
@keyframes gradient-mesh-drift-2 { from { transform: translate(-50%, -50%) translate(0, 0) } to { transform: translate(-50%, -50%) translate(3%, 5%) } }
@keyframes gradient-mesh-drift-3 { from { transform: translate(-50%, -50%) translate(0, 0) } to { transform: translate(-50%, -50%) translate(-4%, -4%) } }
`

export const GradientMesh: EmotionBackground = ({ emotions, reducedMotion, className }) => {
  // Guard emotions[0]: fall back to a single neutral deep-space slice so the field is never empty.
  const slices = emotions.length > 0 ? emotions : FALLBACK_SLICES

  // Placement + base tint depend only on the emotion set, so memoize on it — no per-render Math.random.
  const placements = useMemo(
    () => goldenAnglePlacements(slices, { spread: 0.42, maxRadius: 0.7 }),
    [slices],
  )
  const base = useMemo(() => blendEmotionColors(slices), [slices])

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    // Deep base wash: the blended emotion tone at low alpha over near-black keeps the field mid-toned.
    background: `radial-gradient(120% 120% at 50% 40%, ${rgba(base, 0.28)} 0%, #060608 100%)`,
  }

  return (
    <div aria-hidden className={className} style={rootStyle}>
      {/* Inject drift keyframes once; harmless when reducedMotion since no blob references them. */}
      {!reducedMotion && <style>{DRIFT_KEYFRAMES}</style>}
      {placements.map((placement, index) => {
        // Diameter in vmin units so blobs scale with the container's min side on any aspect ratio.
        const diameterVmin = placement.radius * DIAMETER_SCALE * 100
        const duration = DRIFT_DURATIONS[index % DRIFT_DURATIONS.length]
        const blobStyle: CSSProperties = {
          position: 'absolute',
          left: `${placement.x * 100}%`,
          top: `${placement.y * 100}%`,
          width: `${diameterVmin}vmin`,
          height: `${diameterVmin}vmin`,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          // Soft cosmic blob: bright-ish core to transparent edge; capped alpha avoids white blowout.
          background: `radial-gradient(circle, ${rgba(placement.color, 0.55)} 0%, ${rgba(placement.color, 0.28)} 34%, ${rgba(placement.color, 0)} 68%)`,
          filter: `blur(${BASE_BLUR_PX}px)`,
          mixBlendMode: 'screen',
          willChange: reducedMotion ? undefined : 'transform',
          // Motion branch: attach a per-index drift keyframe. Static branch: leave animation unset so
          // the blob rests at its placement centre (a complete, proportional frame).
          animation: reducedMotion
            ? undefined
            : `gradient-mesh-drift-${index % 4} ${duration}s ease-in-out ${(index % 5) * -3}s infinite alternate`,
        }
        return <div key={`${placement.mood}-${index}`} style={blobStyle} />
      })}
    </div>
  )
}

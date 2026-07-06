import { useId, useMemo, type CSSProperties } from 'react'

import {
  blendEmotionColors,
  cumulativeStops,
  rgba,
  type EmotionBackground,
  type EmotionStop,
} from './emotion-field.ts'

// PLASMA WHEEL — a single conic gradient that slices the field into angular arcs, one per emotion.
//
// WEIGHT -> GEOMETRY
// ------------------
// cumulativeStops() lays the emotions end-to-end along 0..1, each interval's length == its weight.
// We map that axis straight onto the compass: an emotion spanning [start, end] owns the wedge from
// start*360deg to end*360deg. So an emotion's ARC LENGTH is exactly weight * 360deg — that angular
// share IS the proportion. One emotion fills the whole 360deg circle; thirteen split it into
// thirteen fair wedges sized by weight, none able to dominate beyond its share.
//
// To hide the two ugly artifacts of a raw conic gradient — the hard seam at 0deg/360deg and the
// pinched color singularity at the center — we (a) plant a soft rgba stop at every arc's MID angle
// and let CSS interpolate the boundaries, so neighbors bleed into one another instead of butting at
// a hard edge; (b) scale the layer to ~132% and blur it heavily, pushing the seam off-canvas and
// smearing the center into a glow; (c) apply a radial mask so the wheel fades to nothing at the
// rim, leaving a luminous mid-toned core that frosted-glass panels sit on comfortably.
//
// REDUCED MOTION
// --------------
// The wheel normally rotates via a CSS keyframe (slow, linear, 84s). When reducedMotion is true we
// render the identical composition but pinned at a fixed angle (no keyframe emitted at all) — the
// arcs, blur, mask and glow are all static styles, so the single frame is complete and still shows
// every emotion's proportional wedge. No rAF is ever started, nothing to clean up.

const ROTATION_SECONDS = 84
// Fixed angle for the frozen frame — a gentle tilt so the primary arc reads as deliberate, not 12 o'clock.
const STATIC_ANGLE_DEG = -18

/**
 * Build the conic color-stop list. Each emotion contributes a soft stop at its arc midpoint; the
 * boundaries between arcs are left to CSS interpolation so adjacent moods blend rather than clash.
 * A single emotion is handled by repeating its color at 0deg/360deg (a flat, glowing wash).
 */
function buildConicStops(stops: readonly EmotionStop[]): string {
  if (stops.length === 1) {
    const only = stops[0]
    // One emotion: a uniform luminous field of its color (mid-toned alpha keeps panels legible).
    return `${rgba(only.color, 0.85)} 0deg, ${rgba(only.color, 0.85)} 360deg`
  }
  const parts: string[] = []
  for (const stop of stops) {
    const mid = stop.mid * 360
    // Wider arcs get a touch more opacity so a dominant emotion reads as fuller, not just longer.
    const alpha = 0.55 + Math.min(stop.weight, 0.5) * 0.5
    parts.push(`${rgba(stop.color, alpha)} ${mid.toFixed(2)}deg`)
  }
  // Anchor the wrap-around: repeat the first arc's color past 360deg so the seam interpolates
  // smoothly across the 0deg boundary instead of snapping.
  const first = stops[0]
  parts.push(`${rgba(first.color, 0.55 + Math.min(first.weight, 0.5) * 0.5)} 360deg`)
  return parts.join(', ')
}

export const PlasmaConic: EmotionBackground = ({ emotions, reducedMotion, className }) => {
  // useId gives us a collision-free keyframe name so multiple instances don't share one animation.
  const rawId = useId()
  const animationName = `plasma-spin-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  const { conicStops, baseTint } = useMemo(() => {
    // Guard: an empty array would leave emotions[0] undefined downstream. Fall back to deep space.
    const safe = emotions.length > 0 ? emotions : []
    const stops = cumulativeStops(safe)
    return {
      conicStops: stops.length > 0 ? buildConicStops(stops) : rgba('#1a1a2e', 0.6),
      baseTint: blendEmotionColors(safe),
    }
  }, [emotions])

  // Deep, low-saturation ground painted behind the wheel — a weighted-average tint of the emotions
  // present, darkened so the bright arcs float above it rather than fighting it.
  const groundStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(circle at 50% 45%, ${rgba(baseTint, 0.45)} 0%, #08080f 78%)`,
  }

  // The rotating wheel. Oversized (132%) and heavily blurred so the conic seam sits off-canvas and
  // the center singularity dissolves into a soft glow. A radial mask fades it out toward the rim.
  const radialMask =
    'radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.35) 72%, rgba(0,0,0,0) 92%)'

  const wheelStyle: CSSProperties = {
    position: 'absolute',
    // Center a 132%-of-container square and grow it outward equally.
    top: '50%',
    left: '50%',
    width: '132%',
    height: '132%',
    transform: reducedMotion
      ? `translate(-50%, -50%) rotate(${STATIC_ANGLE_DEG}deg)`
      : 'translate(-50%, -50%)',
    transformOrigin: 'center',
    background: `conic-gradient(from 0deg at 50% 50%, ${conicStops})`,
    filter: 'blur(64px) saturate(1.15)',
    WebkitMaskImage: radialMask,
    maskImage: radialMask,
    willChange: reducedMotion ? undefined : 'transform',
    // Motion branch: only emit the animation shorthand when motion is allowed. When reduced, no
    // keyframe is referenced and the fixed rotate() above holds the frame — nothing animates.
    animation: reducedMotion ? undefined : `${animationName} ${ROTATION_SECONDS}s linear infinite`,
  }

  // A second, faster-fading inner glow using the primary emotion's color — lifts the core so the
  // composition has a luminous heart without a pure-white blowout. Primary is emotions[0] (guarded).
  const primaryColor = emotions.length > 0 ? emotions[0].color : baseTint
  const coreGlowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(circle at 50% 48%, ${rgba(primaryColor, 0.28)} 0%, rgba(0,0,0,0) 55%)`,
    mixBlendMode: 'screen',
  }

  return (
    <div
      aria-hidden
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {/* Keyframe emitted only in the motion branch; the animation is a pure transform rotate,
          which stays cheap and never triggers layout. */}
      {!reducedMotion && (
        <style>{`@keyframes ${animationName} {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}`}</style>
      )}
      <div style={groundStyle} />
      <div style={wheelStyle} />
      <div style={coreGlowStyle} />
    </div>
  )
}

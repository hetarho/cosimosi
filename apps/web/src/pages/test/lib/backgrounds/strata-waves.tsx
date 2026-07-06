import { useMemo, type CSSProperties } from 'react'

import {
  blendEmotionColors,
  cumulativeStops,
  rgba,
  type EmotionBackground,
  type EmotionStop,
} from './emotion-field.ts'

// STRATA WAVES — the universe's emotions settle into horizontal geological strata, densest
// at the bottom, thinning skyward. Each emotion is one luminous band; frosted panels float
// over a mid-toned, non-blinding field.
//
// WEIGHT → GEOMETRY
// -----------------
// cumulativeStops lays the emotions end-to-end along 0..1 (interval length = weight). We map
// that axis onto the *vertical* extent, flipped so the primary (first, heaviest) emotion sits
// at the bottom of the field:
//     top    = (1 - stop.end)   * 100%   // higher emotions (later, lighter) ride up top
//     height = (stop.end - start) * 100% = weight * 100%
// So a band's on-screen height is exactly its share of the field. One emotion fills the whole
// column; thirteen emotions subdivide it into thirteen proportional strata, no gaps, no overlap.
// Each band's own gradient goes rgba(color,0.14) at its top → rgba(color,0.5) at its base, so
// weight also reads as luminous mass: a heavy band is a tall, deep-glowing slab; a sliver is a
// faint seam. Bands composite with mix-blend-mode:'screen' over a deep base tinted by the
// weighted-average color, so overlapping soft edges add light rather than muddy.
//
// The wavy top edge is a wide, blurred elliptical highlight riding each band's crest; a gentle
// per-band CSS translateX sway (20–34s, alternating direction by index) makes the strata drift
// like slow tides. Sway is pure CSS keyframes — no rAF, no canvas — so it is cheap and, when
// frozen, leaves a complete static composition.
//
// REDUCED MOTION
// --------------
// reducedMotion === true renders the identical layout but attaches no `animation` at all (the
// crest highlights simply sit centered). No requestAnimationFrame is ever started, so there is
// nothing to cancel; the one static frame already shows the full proportional distribution.

const SWAY_KEYFRAMES = `
@keyframes strata-sway-a {
  0%   { transform: translateX(-6%); }
  100% { transform: translateX(6%); }
}
@keyframes strata-sway-b {
  0%   { transform: translateX(6%); }
  100% { transform: translateX(-6%); }
}
`

export const StrataWaves: EmotionBackground = ({ emotions, reducedMotion, className }) => {
  // Deterministic derivation — no Math.random in render. cumulativeStops is pure over the props.
  const stops = useMemo<EmotionStop[]>(() => cumulativeStops(emotions), [emotions])
  const baseTint = useMemo(() => blendEmotionColors(emotions), [emotions])

  // Guard emotions[0] / empty input: with nothing to show, paint just the deep base so the
  // field never divides by zero and never reads an undefined slice.
  const hasEmotions = stops.length > 0

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  }

  // Deep base behind the strata: a vertical fade from near-black up into the weighted-average
  // emotion tint, so even the gaps between faint edges stay mid-toned and cosmic.
  const baseStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to top, #05060b 0%, ${rgba(baseTint, 0.32)} 60%, ${rgba(
      baseTint,
      0.18,
    )} 100%)`,
  }

  return (
    <div aria-hidden className={className} style={rootStyle}>
      {/* Sway keyframes live inline so the component is fully self-contained. */}
      <style>{SWAY_KEYFRAMES}</style>

      <div style={baseStyle} />

      {hasEmotions &&
        stops.map((stop, index) => {
          const topPct = (1 - stop.end) * 100
          const heightPct = stop.weight * 100
          // Bands drift with a per-index phase and alternating direction; heavier strata sway
          // a touch slower (calmer mass), lighter seams a touch quicker.
          const durationS = 34 - index * 1.1 - stop.weight * 6
          const duration = Math.max(20, durationS)
          const swayName = index % 2 === 0 ? 'strata-sway-a' : 'strata-sway-b'
          const delayS = -(index * 2.3)

          const bandStyle: CSSProperties = {
            position: 'absolute',
            left: '-8%',
            width: '116%',
            top: `${topPct}%`,
            height: `${heightPct}%`,
            mixBlendMode: 'screen',
            // Vertical body gradient: faint at the crest, deep-glowing at the base → weight
            // reads as luminous mass without any pure-white blowout.
            background: `linear-gradient(to bottom, ${rgba(stop.color, 0.14)} 0%, ${rgba(
              stop.color,
              0.34,
            )} 55%, ${rgba(stop.color, 0.5)} 100%)`,
            filter: 'blur(0.5px)',
            ...(reducedMotion
              ? {}
              : {
                  animation: `${swayName} ${duration}s ease-in-out ${delayS}s infinite alternate`,
                }),
          }

          // Wavy, blurred crest riding the top of each band — a wide elliptical highlight that
          // softens the seam between strata into a tidal edge rather than a hard line.
          const crestStyle: CSSProperties = {
            position: 'absolute',
            left: '-10%',
            right: '-10%',
            top: '-14%',
            height: '40%',
            minHeight: '18px',
            background: `radial-gradient(120% 100% at 50% 100%, ${rgba(
              stop.color,
              0.42,
            )} 0%, ${rgba(stop.color, 0.16)} 45%, transparent 72%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }

          return (
            <div key={`${stop.mood}-${index}`} style={bandStyle}>
              <div style={crestStyle} />
            </div>
          )
        })}
    </div>
  )
}

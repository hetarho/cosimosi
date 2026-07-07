import { useMemo, type CSSProperties } from 'react'

import {
  blendEmotionColors,
  cumulativeStops,
  rgba,
  type EmotionBackground,
  type EmotionStop,
} from './emotion-field.ts'

// AuroraFlow — stacked, heavily-blurred aurora curtains.
//
// WEIGHT → GEOMETRY
// -----------------
// The field is a horizontal axis. `cumulativeStops` lays every emotion end-to-end on 0..1,
// each interval [start, end] as wide as its `weight`. Each layer is a ~105° linear-gradient
// whose color stops turn every interval into a soft luminous band:
//     transparent at start%  ·  rgba(color, peak) at mid%  ·  transparent at end%
// So an emotion's band spans exactly its share of the width — 1 emotion fills the whole field,
// 13 emotions each own a fair, proportional slice, with no count clustering. Because bands are
// laid end-to-end (not overlaid) they divide fairly and never mutually blow out to white.
//
// Three layers reuse the SAME stop geometry at different vertical bias, opacity, blur and drift
// speed, so the curtains parallax over one another like a real aurora. A deep base tinted by the
// weighted-average color and a vertical vignette keep the frosted-glass panels readable.
//
// REDUCED MOTION
// --------------
// When reducedMotion is true we start no rAF and attach no running animation: each layer gets a
// fixed static translateX offset (its drift phase frozen mid-stroke) and animation is omitted.
// The static frame still shows every proportional band, so the composition reads as complete.

const LAYERS = [
  // vShift = vertical center of the curtain (%), angle in deg, alpha peak, blur px,
  // drift = horizontal travel (%), dur seconds, static = frozen offset (%) for reduced motion.
  { vShift: 34, angle: 104, peak: 0.5, blur: 46, drift: 7, dur: 30, staticShift: -3 },
  { vShift: 52, angle: 108, peak: 0.42, blur: 60, drift: -9, dur: 38, staticShift: 4 },
  { vShift: 70, angle: 101, peak: 0.34, blur: 70, drift: 6, dur: 26, staticShift: -2 },
] as const

/** Build the linear-gradient color-stop list for one curtain from the shared band geometry. */
function bandGradient(stops: readonly EmotionStop[], angle: number, peak: number): string {
  const parts: string[] = []
  for (const stop of stops) {
    const start = (stop.start * 100).toFixed(2)
    const mid = (stop.mid * 100).toFixed(2)
    const end = (stop.end * 100).toFixed(2)
    // Soft band: fade in from the interval's edge, peak at its midpoint, fade back out.
    parts.push(`${rgba(stop.color, 0)} ${start}%`)
    parts.push(`${rgba(stop.color, peak)} ${mid}%`)
    parts.push(`${rgba(stop.color, 0)} ${end}%`)
  }
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`
}

export const AuroraFlow: EmotionBackground = ({ emotions, reducedMotion, className }) => {
  // Guard every count 1..13: cumulativeStops on an empty list yields [] and the field falls back
  // to the base tint alone. emotions[0] is never indexed directly.
  const stops = useMemo(() => cumulativeStops(emotions), [emotions])
  const baseTint = useMemo(() => blendEmotionColors(emotions), [emotions])

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    // Deep space base, very low-alpha weighted tint layered over near-black so panels stay legible.
    // Longhands only (no `background` shorthand) so the base colour isn't clobbered by the gradient
    // and React doesn't warn about mixing shorthand + non-shorthand for the same property.
    backgroundColor: '#05050a',
    backgroundImage: `radial-gradient(120% 90% at 50% 40%, ${rgba(baseTint, 0.14)} 0%, rgba(6, 6, 12, 0.96) 78%)`,
  }

  return (
    <div aria-hidden className={className} style={rootStyle}>
      {/* Keyframes are scoped by name; playState is paused nowhere — we simply omit the
          animation entirely under reduced motion, so nothing runs. */}
      <style>{`
        @keyframes aurora-flow-drift-0 { from { transform: translate3d(-3%,0,0) } to { transform: translate3d(7%,0,0) } }
        @keyframes aurora-flow-drift-1 { from { transform: translate3d(4%,0,0) } to { transform: translate3d(-9%,0,0) } }
        @keyframes aurora-flow-drift-2 { from { transform: translate3d(-2%,0,0) } to { transform: translate3d(6%,0,0) } }
      `}</style>

      {LAYERS.map((layer, index) => {
        const layerStyle: CSSProperties = {
          position: 'absolute',
          // Curtains are taller than the box and overhang the sides so blur + drift never expose
          // an empty edge. Vertically biased so the three layers stack like ribbons.
          left: '-15%',
          right: '-15%',
          top: `${layer.vShift - 55}%`,
          height: '110%',
          backgroundImage: bandGradient(stops, layer.angle, layer.peak),
          filter: `blur(${layer.blur}px)`,
          mixBlendMode: 'screen',
          willChange: 'transform',
          ...(reducedMotion
            ? // Static composition: freeze each curtain at a fixed offset, run no animation.
              { transform: `translate3d(${layer.staticShift}%, 0, 0)` }
            : {
                animationName: `aurora-flow-drift-${index}`,
                animationDuration: `${layer.dur}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
              }),
        }
        return <div key={index} style={layerStyle} />
      })}

      {/* Vertical vignette: darkens top & bottom so floating frosted-glass panels read cleanly. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(4,4,10,0.55) 0%, rgba(4,4,10,0) 26%, rgba(4,4,10,0) 72%, rgba(4,4,10,0.6) 100%)',
        }}
      />
    </div>
  )
}

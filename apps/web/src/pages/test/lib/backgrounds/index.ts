import { createElement } from 'react'

import type {
  BackgroundCandidate,
  EmotionBackground,
  EmotionBackgroundProps,
} from './emotion-field.ts'
import { ShaderCanvas } from './shader-canvas.tsx'
import type { ShaderEffect } from './shader-effect.ts'

import { evilEye } from './evil-eye.ts'
import { ferrofluid } from './ferrofluid.ts'
import { floatingLines } from './floating-lines.ts'
import { grainient } from './grainient.ts'
import { iridescence } from './iridescence.ts'
import { lightfall } from './lightfall.ts'
import { liquidEther } from './liquid-ether.ts'
import { pixelBlast } from './pixel-blast.ts'
import { pixelSnow } from './pixel-snow.ts'
import { plasmaWave } from './plasma-wave.ts'
import { prismaticBurst } from './prismatic-burst.ts'
import { rippleGrid } from './ripple-grid.ts'
import { softAurora } from './soft-aurora.ts'

// The emotion-driven shader backdrops for the universe showcase. Each is a raw-WebGL2 fragment
// effect inspired by a react-bits shader, re-authored against our emotion contract: it carries the
// *emotions present in the universe* (1..13 colors + weights) and restructures itself by their count
// — one dominant hue at 1, seven legible regions at 7. Presentation-only, no domain input.
export const SHADER_EFFECTS: readonly ShaderEffect[] = [
  iridescence,
  softAurora,
  liquidEther,
  plasmaWave,
  grainient,
  prismaticBurst,
  ferrofluid,
  floatingLines,
  rippleGrid,
  lightfall,
  pixelBlast,
  pixelSnow,
  evilEye,
]

/** Wrap a shader effect as the generic EmotionBackground contract component. */
function toBackground(effect: ShaderEffect): EmotionBackground {
  const Component: EmotionBackground = (props: EmotionBackgroundProps) =>
    createElement(ShaderCanvas, { body: effect.fragment, ...props })
  Component.displayName = `Shader(${effect.key})`
  return Component
}

/** EmotionBackground contract wrappers (one per shader effect), for the showcase switcher. */
export const BACKGROUND_CANDIDATES: readonly BackgroundCandidate[] = SHADER_EFFECTS.map(
  (effect) => ({
    key: effect.key,
    label: effect.label,
    blurb: effect.blurb,
    Component: toBackground(effect),
  }),
)

export { ShaderCanvas }
export type { ShaderEffect }
export type {
  BackgroundCandidate,
  EmotionBackground,
  EmotionBackgroundProps,
  EmotionSlice,
} from './emotion-field.ts'

import { float, floor, fract, instanceIndex, mix, pow, sin, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { iridescent } from '../../shader-art/finish.ts'
import { asFloatNode, asVec3Node } from '../../tsl.ts'

// LIFE and TONE — the third and fourth axes a backdrop theme composes (scatter · mote · life · tone).
//
// LIFE is how a mote's brightness moves, TONE is what colour that brightness is spent on. They are
// separate axes because the two questions are independent: a field can sparkle hard in one colour or
// breathe slowly through several, and every combination is a look someone might want.
//
// Both read PER-MOTE numbers from a hash of the instance id rather than from a CPU buffer, because a
// material never sees an instance — there is one graph for the whole field, and the only thing that
// distinguishes one mote from the next inside it is that id. A hash per salt gives each mote its own
// independent draw, which is what keeps a field from pulsing as one organism.

export type BackdropLifeKey = 'shimmer' | 'blitz' | 'calm' | 'still' | 'wave' | 'strobe'
export type BackdropToneKey = 'starlight' | 'ember' | 'ice' | 'ash' | 'duotone' | 'spectrum'

export interface BackdropFieldInputs {
  /** Seconds, host-timed — frozen to one still frame under reduced motion. */
  readonly time: unknown
  /** The mote's world position over the shell radius, so it lies inside the unit ball. */
  readonly place: unknown
}

const TAU = Math.PI * 2

/** A scattered 0..1 per mote, one independent draw per salt. A smooth walk over the instance id
 *  would make the field pulse as one travelling wave, so the hash deliberately shreds the order. */
function moteHash(salt: number) {
  return fract(sin(float(instanceIndex).mul(12.9898).add(salt)).mul(43758.5453))
}

/** Lift a 0..1 pulse off the floor and scale it by a per-mote dim, so the field stays a mix of faint
 *  and bright motes and nothing ever blinks fully out. */
function graded(pulse: unknown, floorGlow: unknown, dim: unknown) {
  return asFloatNode(pulse)
    .mul(float(1).sub(asFloatNode(floorGlow)))
    .add(asFloatNode(floorGlow))
    .mul(asFloatNode(dim))
}

const LIFE_BUILDERS: Record<BackdropLifeKey, (inputs: BackdropFieldInputs) => unknown> = {
  // Starlight: every mote on its own phase, rate, pulse shape and steady glow, so nothing sweeps
  // through the field in order. The ranges stay moderate on purpose — a steep exponent spends most
  // of each cycle near the floor, and the field reads as dead dots instead of a shimmering sky.
  shimmer: ({ time }) => {
    const phase = moteHash(11.7).mul(TAU)
    const rate = moteHash(31.3).mul(2.1).add(0.5)
    const sharpness = moteHash(57.1).mul(2.5).add(1)
    const pulse = sin(asFloatNode(time).mul(rate).add(phase)).mul(0.5).add(0.5)
    return graded(
      pow(pulse, sharpness),
      moteHash(79.9).mul(0.28).add(0.22),
      moteHash(97.3).mul(0.45).add(0.55),
    )
  },

  // Hard sparks: fast rates and a steep exponent, so each mote is dark most of the time and flares
  // briefly. The floor is low, which is the whole effect — the field crackles rather than shimmers.
  blitz: ({ time }) => {
    const phase = moteHash(3.1).mul(TAU)
    const rate = moteHash(13.9).mul(5.5).add(1.8)
    const sharpness = moteHash(41.3).mul(7).add(5)
    const pulse = sin(asFloatNode(time).mul(rate).add(phase)).mul(0.5).add(0.5)
    return graded(
      pow(pulse, sharpness),
      moteHash(67.7).mul(0.06).add(0.04),
      moteHash(83.1).mul(0.3).add(0.7),
    )
  },

  // A slow breath: rates well under one cycle per second and no sharpening, so the whole field rises
  // and falls gently and no single mote ever catches the eye.
  calm: ({ time }) => {
    const phase = moteHash(5.3).mul(TAU)
    const rate = moteHash(23.7).mul(0.3).add(0.12)
    const pulse = sin(asFloatNode(time).mul(rate).add(phase)).mul(0.5).add(0.5)
    return graded(pulse, moteHash(71.3).mul(0.2).add(0.5), moteHash(89.9).mul(0.4).add(0.6))
  },

  // No movement at all: one brightness per mote, held. The field becomes a fixed backdrop, which is
  // what makes the universe's own bodies the only thing moving in frame.
  still: () => graded(moteHash(19.1), float(0.3), moteHash(43.9).mul(0.45).add(0.55)),

  // One front sweeping the sky: the phase comes from WHERE a mote is rather than from its id, so
  // neighbours light together and the pulse reads as a wave crossing the field.
  wave: ({ time, place }) => {
    const along = asVec3Node(place).dot(vec3(0.42, 0.78, 0.46))
    const pulse = sin(along.mul(6.5).sub(asFloatNode(time).mul(0.9)))
      .mul(0.5)
      .add(0.5)
    return graded(pow(pulse, float(2.2)), float(0.18), moteHash(53.3).mul(0.35).add(0.65))
  },

  // The same pulse, quantized to four levels. Brightness steps instead of easing, so the field
  // reads as switched rather than lit.
  strobe: ({ time }) => {
    const phase = moteHash(29.3).mul(TAU)
    const rate = moteHash(37.1).mul(1.6).add(0.6)
    const pulse = sin(asFloatNode(time).mul(rate).add(phase)).mul(0.5).add(0.5)
    const steps = floor(pulse.mul(4)).div(3).clamp(0, 1)
    return graded(steps, float(0.12), moteHash(61.7).mul(0.35).add(0.65))
  },
}

/** The colours the tone axis mixes. Authored as sRGB hex and converted once, so a tone reads the way
 *  it was picked rather than the way the linear pipeline would darken a raw triple. */
const TONE_COLORS = {
  starlight: 0xcfe0ff,
  ember: 0xffb478,
  ice: 0xdaf6ff,
  ash: 0x9aa0b0,
  core: 0xffd9a0,
  rim: 0x7fa8ff,
} as const

function toneColor(hex: number) {
  const color = new THREE.Color(hex)
  return vec3(color.r, color.g, color.b)
}

const TONE_BUILDERS: Record<BackdropToneKey, (inputs: BackdropFieldInputs) => unknown> = {
  // Cool white — the colour a sky of distant stars already is, and the one that leaves the emotion
  // sky behind it as the only source of hue in frame.
  starlight: () => toneColor(TONE_COLORS.starlight),

  // Warm amber: a dust-lit sky. Reads as air between the viewer and the light rather than vacuum.
  ember: () => toneColor(TONE_COLORS.ember),

  // Near-white with a cold cast, brighter than starlight — the crispest, coldest field in the set.
  ice: () => toneColor(TONE_COLORS.ice),

  // Grey, and dim with it: the field is present but spends almost nothing, so anything coloured in
  // frame belongs to the universe.
  ash: () => toneColor(TONE_COLORS.ash),

  // Warm at the core, cool at the rim — the depth cue a galaxy is read by. Distance is the mix
  // factor, so the gradient is a property of the SPACE rather than of any mote.
  duotone: ({ place }) =>
    mix(
      toneColor(TONE_COLORS.core),
      toneColor(TONE_COLORS.rim),
      asVec3Node(place).length().clamp(0, 1),
    ),

  // A hue per mote, drawn from the same hash the life axis uses. Saturation stays low so the field
  // still reads as light with colour in it rather than as confetti.
  spectrum: () =>
    iridescent(moteHash(7.7).mul(TAU), { baseHue: 0.58, range: 0.42, sat: 0.38, val: 1 }),
}

/** The brightness graph for one life mode — a float node, roughly 0..1. */
export function backdropBrightness(key: BackdropLifeKey, inputs: BackdropFieldInputs) {
  return asFloatNode((LIFE_BUILDERS[key] ?? LIFE_BUILDERS.shimmer)(inputs))
}

/** The tint graph for one tone mode — a linear rgb node. */
export function backdropTint(key: BackdropToneKey, inputs: BackdropFieldInputs) {
  return asVec3Node((TONE_BUILDERS[key] ?? TONE_BUILDERS.starlight)(inputs))
}

import { float, vec3 } from 'three/tsl'
import type { Texture } from 'three/webgpu'

import { asFloatNode, asVec3Node } from '../../tsl.ts'
import { skyAngleTo, skyDir, type SkyAnchor } from './sky-domain.ts'
import { sampleRamp } from './sky-node.ts'

// EMOTION — the third of the four axes a sky recipe composes (domain · field · emotion · finish),
// and the one that decides what a backdrop is FOR.
//
// A sky carries feelings, so the feelings have to divide it. Two rules make that legible, and both
// are structural here rather than left to each recipe:
//
//   Weight buys AREA, never depth. A faint feeling holds a small part of the sky in its own true
//   colour; it is never the same region rendered paler. A hue diluted toward the night is a hue you
//   cannot name, and naming it is the whole job. So `share` sums to one at every point and the colour
//   below is a normalized blend — a weakly-weighted emotion is at full chroma wherever it wins.
//
//   Every feeling gets a place of its own. Anchors are spread over the sphere by the Fibonacci
//   lattice — never a ring or a row, so features do not queue up along a circle and read as one
//   arrangement — and a feature's SIZE comes from its own weight, never from how many feelings there
//   are. Thirteen feelings are thirteen ordinary places, not one crowded circle.
//
// Area is exact rather than eyeballed. A spherical cap of angular radius r covers 2π(1 − cos r) of the
// sphere's 4π, so a cap holding exactly `weight` of the sky has r = acos(1 − 2·weight) — and those
// radii sum to the whole sphere across a normalized weight set. Influence then falls off as an
// inverse power of angular distance, which leaves no gap to fill with grey: every point belongs
// somewhere, most points belong mostly to one feeling.

export interface EmotionFieldArgs {
  /** The emotion palette ramp (see `buildEmotionGradientTexture`). */
  readonly gradient: Texture
  /** How many emotions the universe holds — unrolled at build time. */
  readonly count: number
  /** Normalized shares, primary-first, summing to 1 (parallel to the ramp's bands). */
  readonly weights: readonly number[]
  /** The direction to evaluate at; defaults to the surface direction. */
  readonly dir?: unknown
  /**
   * How sharply a feeling's territory ends. Higher values make zones read as distinct regions with
   * narrow borders; lower values let them wash into one another. This is the only knob a recipe
   * normally touches — a curtain sky wants soft, a cellular sky wants hard.
   */
  readonly sharpness?: number
}

// Node types, taken from a WIDENED expression. TSL infers a narrow const/var node from a literal
// initializer, which a reassignment in an unrolled loop then cannot satisfy; the identity `.add(0)`
// widens it to the operator-node type (a constant fold at runtime — free). Every node this module
// hands out is widened the same way, so a recipe can keep chaining without a cast.
const colorSeed = () => vec3(0, 0, 0).add(0)
const scalarSeed = () => float(0).add(0)

/** A chainable vec3 colour node. */
type ColorNode = ReturnType<typeof colorSeed>
/** A chainable float node. */
type ScalarNode = ReturnType<typeof scalarSeed>

export interface EmotionField {
  /** One unit direction per emotion, spread over the sphere — a feature's home. */
  readonly anchors: readonly SkyAnchor[]
  /** Angular radius of each emotion's territory (area ∝ weight). */
  readonly radii: readonly number[]
  /** Normalized shares as handed in. */
  readonly weights: readonly number[]
  /** Emotion `i`'s own colour, read from the centre of its ramp band. Full chroma, any weight. */
  colorOf(index: number): ColorNode
  /** Emotion `i`'s share of this point, in [0, 1]; the shares over all emotions sum to 1. */
  shareOf(index: number): ScalarNode
  /** Angular distance from this point to emotion `i`'s anchor, in radians. */
  angleTo(index: number): ScalarNode
  /** The blended emotion colour here — a normalized mix, so no feeling is paled by a low weight. */
  readonly color: ColorNode
  /** How squarely this point belongs to its strongest feeling: ~1 deep inside a territory, falling
   *  toward 1/count where several meet. The honest driver for a feature's SIZE or line WIDTH. */
  readonly presence: ScalarNode
}

/** Keeps an influence finite at its own anchor (where the angular distance is zero). */
const ANGLE_FLOOR = 0.04

/**
 * Spread `count` directions over the sphere by the Fibonacci lattice — deterministic and near-uniform
 * at every count, and never a ring: the lattice re-spreads to fill the sphere as the count changes,
 * which is what keeps two feelings from sitting on top of each other and thirteen from queueing up
 * along a circle.
 */
export function emotionAnchors(count: number): SkyAnchor[] {
  const total = Math.max(1, count)
  const golden = Math.PI * (3 - Math.sqrt(5))
  const anchors: SkyAnchor[] = []
  for (let i = 0; i < total; i++) {
    // A single feeling sits at the view centre (−Z) rather than at a pole, so a one-emotion sky opens
    // facing its own colour.
    if (total === 1) {
      anchors.push([0, 0, -1])
      break
    }
    const y = 1 - (2 * i) / (total - 1)
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    anchors.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius])
  }
  return anchors
}

/** The angular radius of a spherical cap covering exactly `weight` of the sphere. */
export function emotionRadius(weight: number): number {
  return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * Math.max(weight, 0))))
}

export function emotionField({
  gradient,
  count,
  weights,
  dir,
  sharpness = 2,
}: EmotionFieldArgs): EmotionField {
  const total = Math.max(1, count)
  const shares = normalize(weights, total)
  const anchors = emotionAnchors(total)
  const radii = shares.map(emotionRadius)
  const point = dir === undefined ? skyDir() : asVec3Node(dir)

  const angles = anchors.map((anchor) => asFloatNode(skyAngleTo(point, anchor)).add(0))
  const colors = shares.map((_, i) =>
    asVec3Node(sampleRamp(gradient, float(rampCenter(shares, i)))).add(0),
  )

  // Influence: a feeling's own weight, divided by how far this point is outside its territory. The
  // radius normalizes the distance, so a wide territory reaches wide and a narrow one stays home —
  // that is where "weight buys area" actually happens.
  const influence = angles.map((angle, i) => {
    const reach = Math.max(radii[i] ?? Math.PI, ANGLE_FLOOR)
    const normalized = angle.div(reach).add(ANGLE_FLOOR)
    return float(shares[i] ?? 0)
      .div(normalized.pow(sharpness))
      .add(0)
  })

  let sum = influence[0]
  for (let i = 1; i < influence.length; i++) sum = sum.add(influence[i])
  const shareNodes = influence.map((value) => value.div(sum).add(0))

  let blended = colors[0].mul(shareNodes[0]).add(0)
  for (let i = 1; i < colors.length; i++) blended = blended.add(colors[i].mul(shareNodes[i]))

  let strongest = shareNodes[0]
  for (let i = 1; i < shareNodes.length; i++) strongest = strongest.max(shareNodes[i]).add(0)

  return {
    anchors,
    radii,
    weights: shares,
    colorOf: (index) => colors[clampIndex(index, total)],
    shareOf: (index) => shareNodes[clampIndex(index, total)],
    angleTo: (index) => angles[clampIndex(index, total)],
    color: blended,
    presence: strongest,
  }
}

function clampIndex(index: number, total: number): number {
  return Math.max(0, Math.min(total - 1, Math.trunc(index)))
}

/** The ramp coordinate at the centre of emotion `i`'s band — the same running-midpoint layout the
 *  ramp texture is baked with, so a feature's colour is the colour of its own band. */
function rampCenter(shares: readonly number[], index: number): number {
  let acc = 0
  for (let i = 0; i < index; i++) acc += shares[i] ?? 0
  return acc + (shares[index] ?? 0) / 2
}

function normalize(weights: readonly number[], count: number): number[] {
  const taken = Array.from({ length: count }, (_, i) => Math.max(weights[i] ?? 0, 0))
  const total = taken.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return taken.map(() => 1 / count)
  return taken.map((w) => w / total)
}

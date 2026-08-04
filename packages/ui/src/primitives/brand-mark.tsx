import { useEffect, useRef } from 'react'

import { useReducedMotion } from '../a11y/use-reduced-motion.ts'
import { cx } from '../lib/cx.ts'
import { palette, primaryRamp } from '../palette.ts'

/**
 * The trademark as a solid: a regular icosahedron, flat-shaded on the primary ramp, turning in place.
 *
 * It is the same body the flat mark shows — twenty faces, ten of them visible at once — so the icon in
 * a header and this are one object seen two ways. It carries no domain meaning: it is not a memory's
 * star, its colour is the brand's own `primary` rather than any feeling, and nothing about its size or
 * brightness projects a stored fact. That is exactly why it wears the ramp and not the emotion table.
 *
 * DELIBERATELY NOT the 3D renderer. `@cosimosi/3d-renderer` hosts the universe — a GPU device, a
 * swapchain and a post chain per canvas, and star bodies whose channels mean things. A brand mark
 * needs none of that, and putting one in a page would cost a third GPU context to draw eleven
 * triangles. Canvas 2D draws the same solid at no such price, and keeps the colour decision here in
 * the design system where the ramp lives.
 *
 * The shading is a half-lambert against a fixed key light, sampled along the ramp, with a narrow
 * specular that mixes toward the theme's own `specular` role — the same physical-light value the glass
 * material's lit edge is built from. A face turned away dims to the bottom of the ramp instead of to
 * black, so the silhouette holds against any ground.
 */
export interface BrandMarkProps {
  /** Box for the mark; the canvas fills it. Size the element, not the drawing. */
  readonly className?: string
  /**
   * Hold the solid still at the angle the flat mark is drawn from. Reduced motion forces this on, so
   * a caller only needs it to place a still mark where motion would be wrong for another reason.
   */
  readonly still?: boolean
}

// The regular icosahedron: twelve vertices on the three golden rectangles, twenty faces.
const PHI = (1 + Math.sqrt(5)) / 2
const VERTICES: readonly (readonly [number, number, number])[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
].map(([x, y, z]) => {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length] as const
})
const FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
]

/**
 * The ladder a face's tone is sampled from, darkest first.
 *
 * It runs the ramp nearly end to end on purpose. A shaded solid is only read as a solid through the
 * SPREAD between its faces, and a narrow ladder — however carefully centred — reads as one flat
 * polygon, because ten faces separated by a step or two of lightness are ten faces nobody can tell
 * apart. Reaching 50 at the top is what makes a lit face look lit.
 */
const LADDER = [700, 600, 500, 400, 300, 200, 100, 50] as const

/**
 * Bias applied to the lambert term before the ladder is sampled.
 *
 * Above 1, and that direction is the whole point. Light from above and in front leaves most of the
 * ten visible faces well lit, so a straight lambert crowds eight of them into the top fifth of the
 * ladder and the solid flattens no matter how bright its brightest face is — the form is carried by
 * the DISTANCE between neighbouring faces, not by the endpoints. Squaring it pushes the middle down
 * and spreads the set out: at 2 the faces separate most evenly across the ladder, and the lit crown
 * still lands at the top of it.
 */
const TONE_GAMMA = 2
/** How narrow the specular is. Higher confines it to the faces most squarely facing the light. */
const SPECULAR_FALLOFF = 16
/** How far the specular carries a face toward the theme's own light colour. */
const SPECULAR_STRENGTH = 0.85

/**
 * The key light: straight above and toward the viewer, with NO sideways component.
 *
 * Zeroing the horizontal is what lets the resting pose below be mirror-symmetric. A light off to one
 * side lights the two halves of a symmetric silhouette differently, and the solid then reads as
 * tilted at the one angle where it is supposed to read as dead-on. The turn is what moves light
 * across the faces; the light itself does not have to be off-axis to do that.
 */
const KEY_LIGHT = ((): readonly [number, number, number] => {
  const [x, y, z] = [0, 0.74, 0.52]
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
})()

/** Radians per second. Slow enough to read as a solid turning rather than a thing spinning. */
const TURN_RATE = 0.22
/** Fraction of the box's half-extent the body's own radius fills; the rest is room for its corners. */
const FILL = 0.94

type Rgb = readonly [number, number, number]

function parseColor(value: string): Rgb {
  const oklch = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/u.exec(value)
  if (oklch) return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]))
  const hex = /^#([0-9a-f]{6})$/iu.exec(value.trim())
  if (hex) {
    const n = Number.parseInt(hex[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  return [0, 0, 0]
}

// OkLCH → sRGB, the same transform the generated theme CSS relies on the browser for. It is here
// because a canvas takes numbers, not a colour string the compositor resolves.
function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ]
  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
  const encode = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
  }
  return [encode(linear[0]), encode(linear[1]), encode(linear[2])]
}

const TONES: readonly Rgb[] = LADDER.map((step) => parseColor(primaryRamp[step]))
const SPECULAR: Rgb = parseColor(palette.specular)

const mix = (from: Rgb, to: Rgb, t: number): Rgb => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
]

/** Sample the ladder continuously, so a turning face slides between steps instead of snapping. */
function sampleLadder(t: number): Rgb {
  const scaled = Math.min(1, Math.max(0, t)) * (TONES.length - 1)
  const low = Math.floor(scaled)
  const high = Math.min(TONES.length - 1, low + 1)
  return mix(TONES[low], TONES[high], scaled - low)
}

const css = ([r, g, b]: Rgb) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`

const dot = (a: Rgb, b: readonly [number, number, number]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function faceNormal(face: readonly [number, number, number]): readonly [number, number, number] {
  let [x, y, z] = [0, 0, 0]
  for (const index of face) {
    x += VERTICES[index][0]
    y += VERTICES[index][1]
    z += VERTICES[index][2]
  }
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

type Vec3 = readonly [number, number, number]
type Mat3 = readonly [Vec3, Vec3, Vec3]

const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]

/** Rotation taking one unit vector onto another (Rodrigues, with no rotation about the result). */
function align(from: Vec3, to: Vec3): Mat3 {
  const v: Vec3 = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ]
  const c = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  const k = 1 / (1 + c)
  const [x, y, z] = v
  return [
    [c + x * x * k, x * y * k - z, x * z * k + y],
    [y * x * k + z, c + y * y * k, y * z * k - x],
    [z * x * k - y, z * y * k + x, c + z * z * k],
  ]
}

/**
 * The resting pose: down a 3-fold axis, rolled so the silhouette's corners sit at the same angles the
 * flat mark's do — mirror-symmetric about the vertical, one corner straight up.
 *
 * Both halves matter. The icosahedron is centrally symmetric, so the silhouette down a 3-fold axis has
 * six-fold symmetry (a regular hexagon) while the FACE pattern inside it has only three-fold plus three
 * mirrors. Just one roll in six puts a mirror upright, and it is derived here rather than written down
 * so it cannot drift from the flat asset by a rounding.
 */
const multiply = (a: Mat3, b: Mat3): Mat3 => {
  const cell = (r: number, c: number) => a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c]
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ]
}

const RESTING: Mat3 = (() => {
  const axis = align(faceNormal(FACES[0]), [0, 0, 1])
  const corners = VERTICES.map((vertex) => apply(axis, vertex))
  const reach = Math.max(...corners.map(([x, y]) => Math.hypot(x, y)))
  const corner = corners.find(([x, y]) => Math.hypot(x, y) > reach - 1e-9) ?? corners[0]
  const roll = Math.PI / 2 - Math.atan2(corner[1], corner[0])
  const [cos, sin] = [Math.cos(roll), Math.sin(roll)]
  const rollZ: Mat3 = [
    [cos, -sin, 0],
    [sin, cos, 0],
    [0, 0, 1],
  ]
  return multiply(rollZ, axis)
})()

const RESTING_VERTICES = VERTICES.map((vertex) => apply(RESTING, vertex))
const RESTING_NORMALS = FACES.map((face) => apply(RESTING, faceNormal(face)))

/**
 * Turn about the vertical, from the resting pose.
 *
 * At angle 0 this IS the flat mark's view, so the still form and the flat asset are the same picture of
 * the same solid; the turn carries it away from there and back. Turning about the view axis instead
 * would hold the silhouette fixed and spin the faces inside it, which reads as a rosette rather than a
 * solid rotating.
 */
function turn(point: Vec3, angle: number): Vec3 {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  return [point[0] * cos + point[2] * sin, point[1], -point[0] * sin + point[2] * cos]
}

export function BrandMark({ className, still = false }: BrandMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = useReducedMotion()
  const held = still || reducedMotion

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frame = 0
    let start: number | undefined

    const draw = (angle: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      context.clearRect(0, 0, width, height)

      const radius = (Math.min(width, height) / 2) * FILL
      const project = (point: Vec3) =>
        [width / 2 + point[0] * radius, height / 2 - point[1] * radius] as const

      const turned = RESTING_VERTICES.map((vertex) => turn(vertex, angle))

      // Each face is stroked in its own fill colour as well as filled, which is what keeps the grey
      // hairlines out. Two triangles that share an edge are rasterized independently, and each covers
      // only about half of every pixel along it, so the two half-coverages composite over the page
      // instead of over each other and the ground shows through as a seam. A one-device-pixel stroke
      // carries each face half a pixel past its own edge, so neighbours overlap and the seam has
      // nothing to show through. Round joins because a face seen nearly edge-on is a sliver, and a
      // mitre on a sliver throws a spike well outside the silhouette.
      context.lineJoin = 'round'
      context.lineWidth = 1

      // Only the faces pointing at the viewer are drawn, decided by their winding on screen. A
      // convex solid needs no depth sort: the visible set never overlaps itself.
      for (const [index, face] of FACES.entries()) {
        const [a, b, c] = face.map((vertexIndex) => project(turned[vertexIndex]))
        const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
        if (area >= 0) continue

        const normal = turn(RESTING_NORMALS[index], angle)
        const lambert = Math.max(0, dot(normal, KEY_LIGHT) * 0.5 + 0.5)
        const tone = sampleLadder(lambert ** TONE_GAMMA)
        const specular = lambert ** SPECULAR_FALLOFF * SPECULAR_STRENGTH

        context.beginPath()
        context.moveTo(a[0], a[1])
        context.lineTo(b[0], b[1])
        context.lineTo(c[0], c[1])
        context.closePath()
        const paint = css(mix(tone, SPECULAR, specular))
        context.fillStyle = paint
        context.strokeStyle = paint
        context.fill()
        context.stroke()
      }
    }

    // Held still, the resting pose IS the flat mark's view, so a still solid and the flat asset are
    // the same picture. The observer is only here because a still canvas has nothing else to redraw it.
    if (held) {
      draw(0)
      const observer = new ResizeObserver(() => draw(0))
      observer.observe(canvas)
      return () => observer.disconnect()
    }

    const step = (now: number) => {
      start ??= now
      draw(((now - start) / 1000) * TURN_RATE)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [held])

  return <canvas ref={canvasRef} aria-hidden="true" className={cx('block size-full', className)} />
}

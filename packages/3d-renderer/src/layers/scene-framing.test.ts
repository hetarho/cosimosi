import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'
import { fitSceneBounds, type FrameInsets } from './scene-framing.ts'

const bounds = { min: [-28, -24, -16] as const, max: [28, 24, 74] as const }
const direction = [0, -80, 42] as const

// Every corner of the bounds, projected through the fitted camera, in CSS pixels from the top left.
function projectedCorners(width: number, height: number, insets: FrameInsets) {
  const fit = fitSceneBounds(bounds, width, height, 55, direction, insets, 90, 420)
  const camera = new PerspectiveCamera(55, width / height, 0.1, 2000)
  camera.up.set(0, 0, 1)
  camera.position.copy(fit.position)
  camera.lookAt(fit.target)
  camera.updateMatrixWorld()
  return Array.from({ length: 8 }, (_, corner) => {
    const point = new Vector3(
      corner & 1 ? bounds.max[0] : bounds.min[0],
      corner & 2 ? bounds.max[1] : bounds.min[1],
      corner & 4 ? bounds.max[2] : bounds.min[2],
    ).project(camera)
    return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 }
  })
}

describe('overview framing', () => {
  it('reproduces the risen gist clipping in the fixed origin-facing camera', () => {
    const camera = new PerspectiveCamera(55, 1024 / 768)
    camera.position.set(...direction)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    expect(new Vector3(0, 0, 54).project(camera).y).toBeGreaterThan(1)
  })

  it.each([
    [1024, 768, { left: 24, right: 24, top: 96, bottom: 128 }],
    [390, 844, { left: 24, right: 24, top: 96, bottom: 128 }],
    [1024, 768, { left: 24, right: 376, top: 96, bottom: 128 }],
    [390, 844, { left: 24, right: 24, top: 96, bottom: 428 }],
    [844, 390, { left: 24, right: 24, top: 64, bottom: 80 }],
  ] as const)(
    'keeps the complete episodic and gist bounds visible at %s × %s',
    (width, height, insets: FrameInsets) => {
      for (const { x, y } of projectedCorners(width, height, insets)) {
        expect(x).toBeGreaterThanOrEqual(insets.left - 0.001)
        expect(x).toBeLessThanOrEqual(width - insets.right + 0.001)
        expect(y).toBeGreaterThanOrEqual(insets.top - 0.001)
        expect(y).toBeLessThanOrEqual(height - insets.bottom + 0.001)
      }
    },
  )

  it('lets a top-heavy inset push the whole frame below it', () => {
    // A phone with a band over its upper half: the open region starts at 421px, past 0.4 of 844.
    const insets = { left: 24, right: 24, top: 421, bottom: 128 }
    const corners = projectedCorners(390, 844, insets)
    expect(Math.min(...corners.map(({ y }) => y))).toBeGreaterThanOrEqual(insets.top - 0.001)
    expect(Math.max(...corners.map(({ y }) => y))).toBeLessThanOrEqual(844 - insets.bottom + 0.001)
  })

  it.each([
    [390, 844, { left: 24, right: 24, top: 700, bottom: 700 }],
    [390, 844, { left: 24, right: 24, top: 2000, bottom: 2000 }],
    [844, 390, { left: 24, right: 24, top: 390, bottom: 80 }],
  ] as const)(
    'never inverts the frame under extreme insets at %s × %s',
    (width, height, insets) => {
      const fit = fitSceneBounds(bounds, width, height, 55, direction, insets, 90, 420)
      const camera = new PerspectiveCamera(55, width / height, 0.1, 2000)
      camera.up.set(0, 0, 1)
      camera.position.copy(fit.position)
      camera.lookAt(fit.target)
      camera.updateMatrixWorld()
      const center = new Vector3(0, 0, 29).project(camera)
      const centerY = ((1 - center.y) * height) / 2
      // The bounds' centre lands mid-region; a region at least the minimum span tall above the
      // clamped bottom inset puts it at least half that span above the bottom inset's edge.
      const bottomEdge = height - Math.min(insets.bottom, height * 0.8)
      expect(Number.isFinite(fit.distance)).toBe(true)
      expect(centerY).toBeGreaterThanOrEqual(0)
      expect(centerY).toBeLessThanOrEqual(bottomEdge - height * 0.025 + 0.001)
    },
  )

  // Values the fit produced before the top inset stopped being capped at 0.4 of the height: any
  // inset that was never capped frames exactly as it did.
  it.each([
    [
      1024,
      768,
      { left: 24, right: 24, top: 96, bottom: 128 },
      138.62027542646592,
      [0, -124.13172397615122, 90.77326439555952],
      [0, -1.397622822740174, 26.337861290018715],
    ],
    [
      390,
      844,
      { left: 24, right: 24, top: 96, bottom: 128 },
      174.90581671500385,
      [0, -156.46591523230225, 107.24563479930856],
      [0, -1.6046719186801146, 25.943482059656926],
    ],
    [
      1024,
      768,
      { left: 24, right: 376, top: 96, bottom: 128 },
      138.62027542646592,
      [33.073859465820284, -124.13172397615122, 90.77326439555952],
      [33.073859465820284, -1.397622822740174, 26.337861290018715],
    ],
    [
      390,
      844,
      { left: 24, right: 24, top: 96, bottom: 428 },
      258.37818149289785,
      [0, -253.3613173386522, 102.25757122058539],
      [0, -24.593817305758897, -17.845366296683608],
    ],
    [
      844,
      390,
      { left: 24, right: 24, top: 64, bottom: 80 },
      155.6255705697329,
      [0, -139.3354909037439, 98.39730342980471],
      [0, -1.5449370933440034, 26.057262679344756],
    ],
    [
      390,
      844,
      { left: 24, right: 24, top: 96, bottom: 718 },
      420,
      [0, -441.6116031371623, 91.38360148962178],
      [0, -69.74448394522602, -103.84663608614477],
    ],
    [
      390,
      844,
      { left: 24, right: 24, top: 300, bottom: 128 },
      199.2313283794852,
      [0, -166.5743274464434, 140.32313780085434],
      [0, 9.824672880370453, 47.71366262927705],
    ],
  ] as const)(
    'frames ordinary insets exactly as before at %s × %s',
    (width, height, insets, distance, position, target) => {
      const fit = fitSceneBounds(bounds, width, height, 55, direction, insets, 90, 420)
      expect(fit.distance).toBeCloseTo(distance, 9)
      fit.position.toArray().forEach((value, axis) => expect(value).toBeCloseTo(position[axis]!, 9))
      fit.target.toArray().forEach((value, axis) => expect(value).toBeCloseTo(target[axis]!, 9))
    },
  )
})

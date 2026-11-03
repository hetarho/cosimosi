import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'
import { fitSceneBounds, type FrameInsets } from './scene-framing.ts'

const bounds = { min: [-28, -24, -16] as const, max: [28, 24, 74] as const }
const direction = [0, -80, 42] as const

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
      const fit = fitSceneBounds(bounds, width, height, 55, direction, insets, 90, 420)
      const camera = new PerspectiveCamera(55, width / height, 0.1, 2000)
      camera.up.set(0, 0, 1)
      camera.position.copy(fit.position)
      camera.lookAt(fit.target)
      camera.updateMatrixWorld()
      for (let corner = 0; corner < 8; corner++) {
        const point = new Vector3(
          corner & 1 ? bounds.max[0] : bounds.min[0],
          corner & 2 ? bounds.max[1] : bounds.min[1],
          corner & 4 ? bounds.max[2] : bounds.min[2],
        ).project(camera)
        const x = ((point.x + 1) * width) / 2
        const y = ((1 - point.y) * height) / 2
        expect(x).toBeGreaterThanOrEqual(insets.left - 0.001)
        expect(x).toBeLessThanOrEqual(width - insets.right + 0.001)
        expect(y).toBeGreaterThanOrEqual(insets.top - 0.001)
        expect(y).toBeLessThanOrEqual(height - insets.bottom + 0.001)
      }
    },
  )
})

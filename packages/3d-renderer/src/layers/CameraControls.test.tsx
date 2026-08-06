// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CameraControls } from './CameraControls.tsx'

// The real TrackballControls attaches wheel/pointer listeners and runs its own math; the layer's
// whole job here is which settings it writes onto the instance, so the instance is a plain record.
const instances = vi.hoisted<Record<string, unknown>[]>(() => [])

vi.mock('three/addons/controls/TrackballControls.js', () => ({
  TrackballControls: class {
    handleResize = vi.fn()
    dispose = vi.fn()
    constructor() {
      instances.push(this as unknown as Record<string, unknown>)
    }
  },
}))

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ camera: {}, gl: { domElement: document.createElement('div') } }),
  useFrame: () => undefined,
}))

describe('CameraControls', () => {
  it('wears the zoom envelope it is handed rather than one of its own', () => {
    instances.length = 0
    render(<CameraControls minDistance={8} maxDistance={420} />)

    // A default here would be a second copy of the universe's envelope — the exact drift (20 vs 8)
    // this layer's required props exist to prevent.
    expect(instances).toHaveLength(1)
    expect(instances[0]).toMatchObject({ minDistance: 8, maxDistance: 420 })
  })

  it('applies the shared trackball feel', () => {
    instances.length = 0
    render(<CameraControls minDistance={8} maxDistance={420} />)

    expect(instances[0]).toMatchObject({
      staticMoving: false,
      dynamicDampingFactor: 0.15,
      zoomSpeed: 1.2,
      noPan: true,
    })
  })
})

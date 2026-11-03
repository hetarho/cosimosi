// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera } from 'three/webgpu'

const renderer = vi.hoisted(() => ({
  frame: null as null | ((state: unknown, delta: number) => void),
  camera: null as unknown,
}))
vi.mock('@react-three/fiber', () => ({
  useFrame: (frame: typeof renderer.frame) => {
    renderer.frame = frame
  },
  useThree: (select: (state: unknown) => unknown) =>
    select({ camera: renderer.camera, size: { width: 1024, height: 768 } }),
}))
import { SceneFraming } from './SceneFraming.tsx'

afterEach(cleanup)
describe('focused camera handoff', () => {
  it('reports each requested focus once after it arrives, with no frame-by-frame reports', () => {
    renderer.camera = new PerspectiveCamera(55, 1024 / 768)
    const onSettled = vi.fn()
    const common = {
      direction: [0, -80, 42] as const,
      insets: { left: 24, right: 24, top: 96, bottom: 96 },
      maxDistance: 420,
      enabled: true,
      reducedMotion: false,
      targetRef: { current: [0, 0, 0] as [number, number, number] },
    }
    const bounds = { min: [-4, -4, -4] as const, max: [4, 4, 4] as const }
    const view = render(<SceneFraming {...common} getBounds={() => bounds} minDistance={90} />)
    act(() => renderer.frame?.({}, 1 / 60))
    view.rerender(
      <SceneFraming
        {...common}
        getBounds={() => bounds}
        minDistance={18}
        settleKey="recall-1"
        onSettled={onSettled}
      />,
    )
    act(() => renderer.frame?.({}, 1 / 60))
    expect(onSettled).not.toHaveBeenCalled()
    act(() => {
      for (let i = 0; i < 300; i++) renderer.frame?.({}, 1 / 60)
    })
    expect(onSettled).toHaveBeenCalledTimes(1)
    view.rerender(
      <SceneFraming
        {...common}
        getBounds={() => bounds}
        minDistance={18}
        settleKey="recall-2"
        onSettled={onSettled}
      />,
    )
    act(() => renderer.frame?.({}, 1 / 60))
    expect(onSettled).toHaveBeenCalledTimes(2)
  })
})

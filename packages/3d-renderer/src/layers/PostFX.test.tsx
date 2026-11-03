// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The pipeline needs a WebGPU device; the stubs stand in for exactly what PostFX owns — the
// pipeline, the scene pass and the bloom node — so their lifetimes can be counted.
const created = vi.hoisted(() => ({
  pipelines: [] as { dispose: ReturnType<typeof vi.fn> }[],
  passes: [] as { dispose: ReturnType<typeof vi.fn> }[],
  blooms: [] as {
    dispose: ReturnType<typeof vi.fn>
    strength: { value: number }
    radius: { value: number }
    threshold: { value: number }
  }[],
}))

const three = vi.hoisted(() => ({ gl: {}, scene: {}, camera: {} }))

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: Record<string, unknown>) => unknown) => select(three),
  useFrame: () => undefined,
}))

vi.mock('three/webgpu', () => ({
  RenderPipeline: class {
    outputNode: unknown = null
    dispose = vi.fn()
    render = vi.fn()
    constructor() {
      created.pipelines.push(this)
    }
  },
}))

vi.mock('three/tsl', () => ({
  pass: () => {
    const node = { dispose: vi.fn(), add: () => ({}), rgb: { add: () => ({}) }, a: {} }
    created.passes.push(node)
    return node
  },
  vec4: () => ({}),
}))

vi.mock('three/addons/tsl/display/BloomNode.js', () => ({
  bloom: () => {
    const node = {
      dispose: vi.fn(),
      rgb: {},
      strength: { value: 1 },
      radius: { value: 0 },
      threshold: { value: 0 },
    }
    created.blooms.push(node)
    return node
  },
}))

const { PostFX } = await import('./PostFX.tsx')

afterEach(() => {
  cleanup()
  created.pipelines.length = 0
  created.passes.length = 0
  created.blooms.length = 0
})

describe('PostFX resource lifetime', () => {
  it('retunes the same bloom node instead of building a second pass on a new bloom', () => {
    const view = render(<PostFX bloom={{ strength: 0.8, radius: 0.4, threshold: 0.2 }} />)
    expect(created.blooms).toHaveLength(1)
    expect(created.blooms[0]?.strength.value).toBe(0.8)

    view.rerender(<PostFX bloom={{ strength: 1.2, radius: 0.5, threshold: 0.1 }} />)
    expect(created.pipelines).toHaveLength(1)
    expect(created.passes).toHaveLength(1)
    expect(created.blooms).toHaveLength(1)
    expect(created.blooms[0]?.strength.value).toBe(1.2)
    expect(created.blooms[0]?.radius.value).toBe(0.5)
    expect(created.blooms[0]?.threshold.value).toBe(0.1)
  })

  it('disposes the pipeline, the bloom node and the scene pass on unmount', () => {
    const view = render(<PostFX bloom={{ strength: 1, radius: 0, threshold: 0 }} />)
    view.unmount()
    expect(created.pipelines[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(created.blooms[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(created.passes[0]?.dispose).toHaveBeenCalledTimes(1)
  })

  it('releases the old chain when the output mode rebuilds it', () => {
    const view = render(<PostFX bloom={{ strength: 1, radius: 0, threshold: 0 }} />)
    view.rerender(<PostFX bloom={{ strength: 1, radius: 0, threshold: 0 }} transparent />)
    expect(created.pipelines).toHaveLength(2)
    expect(created.blooms[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(created.passes[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(created.blooms[1]?.dispose).not.toHaveBeenCalled()
  })
})

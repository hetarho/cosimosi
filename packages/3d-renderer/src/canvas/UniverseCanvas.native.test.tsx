// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The native canvas host drives an R3F root by hand, so it — not R3F — owns when the WebGPU device
 * is built and released (ARCHITECTURE §3.5: the fork owns its test). What this pins is the effect
 * split: a re-render or a config change must reach the running root, and only a backend switch or a
 * real unmount may touch the device.
 *
 * It runs here rather than in the mobile Jest arm because that arm stubs the whole
 * `@cosimosi/3d-renderer` package by design (`three` ships ESM it does not transform), so it can
 * never see this file. The three platform modules are mocked instead — the seams under test are
 * R3F's root API and the renderer's, both of which are visible through the mocks.
 */
const spies = vi.hoisted(() => ({
  createRoot: vi.fn(),
  configure: vi.fn(),
  renderScene: vi.fn(),
  unmountComponentAtNode: vi.fn(),
  dispose: vi.fn(),
  setDpr: vi.fn(),
  updateProjectionMatrix: vi.fn(),
  setClearColor: vi.fn(),
  renderers: [] as unknown[],
  /** The `onCreated` R3F would invoke once its Provider mounts. */
  onCreated: null as null | ((state: unknown) => void),
  camera: { isPerspectiveCamera: true, fov: 0, far: 0, updateProjectionMatrix: vi.fn() },
}))

vi.mock('@react-three/fiber', () => ({
  extend: () => undefined,
  events: () => ({}),
  unmountComponentAtNode: spies.unmountComponentAtNode,
  createRoot: (canvas: unknown) => {
    spies.createRoot(canvas)
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configure: async (props: any) => {
        spies.configure(props)
        // R3F resolves the async `gl` factory inside configure, before anything renders.
        await props.gl?.()
        spies.onCreated = props.onCreated ?? null
        return undefined
      },
      render: spies.renderScene,
    }
  },
}))

vi.mock('react-native', () => ({
  PixelRatio: { get: () => 3 },
}))

vi.mock('react-native-webgpu', () => ({
  // Stands in for the native surface: a fresh DOM-canvas-shaped shim per getContext call, which is
  // what the real module does (each call mints a new GPUCanvasContext with its own canvas).
  Canvas: ({ ref }: { ref: { current: unknown } }) => {
    if (ref) {
      ref.current = {
        getContext: () => ({
          canvas: { width: 0, height: 0, clientWidth: 200, clientHeight: 400 },
          present: () => undefined,
        }),
      }
    }
    return <div data-testid="rn-webgpu-canvas" />
  },
}))

vi.mock('three/webgpu', () => {
  class WebGPURenderer {
    toneMapping = 0
    toneMappingExposure = 1
    dispose = spies.dispose
    setClearColor = spies.setClearColor
    init = vi.fn(async () => undefined)
    getRenderTarget = () => null
    render = vi.fn()
    constructor() {
      spies.renderers.push(this)
    }
  }
  return {
    WebGPURenderer,
    NoToneMapping: 0,
    LinearToneMapping: 1,
    ReinhardToneMapping: 2,
    CineonToneMapping: 3,
    ACESFilmicToneMapping: 4,
    AgXToneMapping: 6,
    NeutralToneMapping: 7,
  }
})

const { UniverseCanvas } = await import('./UniverseCanvas.native.tsx')

/** Hand the host the R3F state its `onCreated` would receive, so live config has somewhere to land. */
async function completeR3FBringUp() {
  await vi.waitFor(() => expect(spies.onCreated).not.toBeNull())
  spies.onCreated?.({ camera: spies.camera, setDpr: spies.setDpr })
}

const SCENE_A = <div data-testid="scene-a" />
const SCENE_B = <div data-testid="scene-b" />

describe('UniverseCanvas (native) device lifecycle', () => {
  beforeEach(() => {
    for (const spy of [
      spies.createRoot,
      spies.configure,
      spies.renderScene,
      spies.unmountComponentAtNode,
      spies.dispose,
      spies.setDpr,
      spies.setClearColor,
      spies.camera.updateProjectionMatrix,
    ]) {
      spy.mockClear()
    }
    spies.renderers.length = 0
    spies.onCreated = null
    spies.camera.fov = 0
    spies.camera.far = 0
  })

  it('re-renders new children into the same root without touching the device', async () => {
    const view = render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    const device = spies.renderers[0]
    expect(spies.renderScene).toHaveBeenCalledTimes(1)

    view.rerender(<UniverseCanvas>{SCENE_B}</UniverseCanvas>)

    expect(spies.renderScene).toHaveBeenCalledTimes(2)
    expect(spies.createRoot).toHaveBeenCalledTimes(1)
    expect(spies.renderers).toHaveLength(1)
    expect(spies.renderers[0]).toBe(device)
    expect(spies.dispose).not.toHaveBeenCalled()
    expect(spies.unmountComponentAtNode).not.toHaveBeenCalled()
  })

  it('hot-applies dpr, camera and tone changes to the live root', async () => {
    const view = render(
      <UniverseCanvas dpr={[1, 2]} fov={55} far={1400} clearColor={0x000000}>
        {SCENE_A}
      </UniverseCanvas>,
    )
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    const device = spies.renderers[0]
    await completeR3FBringUp()

    // The mocked device reports PixelRatio 3, so the cap — not the device — decides the ratio.
    expect(spies.setDpr).toHaveBeenLastCalledWith(2)

    view.rerender(
      <UniverseCanvas dpr={[1, 1.5]} fov={40} far={900} clearColor={0x101020}>
        {SCENE_A}
      </UniverseCanvas>,
    )

    expect(spies.setDpr).toHaveBeenLastCalledWith(1.5)
    expect(spies.camera.fov).toBe(40)
    expect(spies.camera.far).toBe(900)
    expect(spies.camera.updateProjectionMatrix).toHaveBeenCalled()
    expect(spies.setClearColor).toHaveBeenLastCalledWith(0x101020, 1)
    // None of it rebuilt anything.
    expect(spies.createRoot).toHaveBeenCalledTimes(1)
    expect(spies.renderers).toHaveLength(1)
    expect(spies.renderers[0]).toBe(device)
    expect(spies.dispose).not.toHaveBeenCalled()
  })

  it('disposes the device exactly once on unmount', async () => {
    const view = render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))

    view.unmount()

    expect(spies.unmountComponentAtNode).toHaveBeenCalledTimes(1)
    expect(spies.dispose).toHaveBeenCalledTimes(1)
  })

  it('rebuilds the device only when the GPU backend switches', async () => {
    const view = render(<UniverseCanvas forceWebGL={false}>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))

    view.rerender(<UniverseCanvas forceWebGL>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(2))

    // Dispose-then-recreate, exactly once each: a WebGPURenderer cannot move to the WebGL2 path in
    // place, so this is the one prop allowed to cost a device.
    expect(spies.dispose).toHaveBeenCalledTimes(1)
    expect(spies.createRoot).toHaveBeenCalledTimes(2)
    expect(spies.renderers[1]).not.toBe(spies.renderers[0])
  })

  it('survives StrictMode double-invoke with one live device', async () => {
    render(
      <StrictMode>
        <UniverseCanvas>{SCENE_A}</UniverseCanvas>
      </StrictMode>,
    )
    await vi.waitFor(() => expect(spies.createRoot).toHaveBeenCalledTimes(2))

    // StrictMode's simulated unmount releases the first bring-up's device and the re-mount builds a
    // fresh one: two devices built, exactly one released, none released twice. This holds only
    // because the `gl` factory assigns the renderer ref synchronously — R3F's `configure` runs to
    // its first `await` inside the effect body, so a cleanup in the same commit always finds it.
    expect(spies.renderers).toHaveLength(2)
    expect(spies.dispose).toHaveBeenCalledTimes(1)
  })
})

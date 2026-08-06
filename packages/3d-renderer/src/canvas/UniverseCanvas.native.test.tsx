// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { StrictMode, useMemo, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VALUES } from '@cosimosi/config'

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
  setFrameloop: vi.fn(),
  updateProjectionMatrix: vi.fn(),
  setClearColor: vi.fn(),
  renderers: [] as unknown[],
  /** The `onCreated` R3F would invoke once its Provider mounts. */
  onCreated: null as null | ((state: unknown) => void),
  camera: { isPerspectiveCamera: true, fov: 0, far: 0, updateProjectionMatrix: vi.fn() },
  /** Stands in for RN's AppState: the live status plus every registered listener. */
  appState: {
    currentState: 'active' as string | null,
    listeners: new Set<(status: string) => void>(),
    removals: 0,
  },
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
  AppState: {
    get currentState() {
      return spies.appState.currentState
    },
    addEventListener: (_event: string, listener: (status: string) => void) => {
      spies.appState.listeners.add(listener)
      return {
        remove: () => {
          spies.appState.listeners.delete(listener)
          spies.appState.removals += 1
        },
      }
    },
  },
}))

/** Drive RN's app-state transition: set the status, then notify, the way AppState does. */
function emitAppState(status: string) {
  spies.appState.currentState = status
  for (const listener of [...spies.appState.listeners]) listener(status)
}

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
const { ADAPTIVE_DPR_FLOOR, createAdaptiveDprSampler, sampleAdaptiveDpr } =
  await import('../layers/adaptive-dpr.ts')

/** Hand the host the R3F state its `onCreated` would receive, so live config has somewhere to land. */
async function completeR3FBringUp() {
  await vi.waitFor(() => expect(spies.onCreated).not.toBeNull())
  spies.onCreated?.({
    camera: spies.camera,
    setDpr: spies.setDpr,
    setFrameloop: spies.setFrameloop,
  })
}

const SCENE_A = <div data-testid="scene-a" />
const SCENE_B = <div data-testid="scene-b" />

/**
 * Stands in for the mobile thin shell's half of the adaptive-DPR bridge (it owns the cap in state
 * and hands the host a `dpr` prop). The scene itself cannot run here — the R3F root is a spy — so
 * the test drives the real sampler and pushes its step through `step`, which is exactly what
 * `AdaptiveDprLayer`'s `onPixelRatio` does on a device.
 */
const step: { current: (pixelRatio: number) => void } = { current: () => undefined }
function AdaptiveShell() {
  const [cap, setCap] = useState<number>(2)
  step.current = setCap
  const dpr = useMemo<[number, number]>(() => [ADAPTIVE_DPR_FLOOR, cap], [cap])
  return <UniverseCanvas dpr={dpr}>{SCENE_A}</UniverseCanvas>
}

describe('UniverseCanvas (native) device lifecycle', () => {
  beforeEach(() => {
    for (const spy of [
      spies.createRoot,
      spies.configure,
      spies.renderScene,
      spies.unmountComponentAtNode,
      spies.dispose,
      spies.setDpr,
      spies.setFrameloop,
      spies.setClearColor,
      spies.camera.updateProjectionMatrix,
    ]) {
      spy.mockClear()
    }
    spies.renderers.length = 0
    spies.onCreated = null
    spies.camera.fov = 0
    spies.camera.far = 0
    spies.appState.currentState = 'active'
    spies.appState.listeners.clear()
    spies.appState.removals = 0
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

  it('pauses the frame loop while the app is backgrounded and resumes on foreground', async () => {
    render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    await completeR3FBringUp()
    // Brought up in the foreground, so the loop starts running.
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('always')

    emitAppState('background')
    // Nothing renders — and the sim pump rides the same loop (`FrameTick`), so it stops too.
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('never')

    emitAppState('active')
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('always')
    // Pausing is imperative: it reaches the running root and costs no device.
    expect(spies.createRoot).toHaveBeenCalledTimes(1)
    expect(spies.dispose).not.toHaveBeenCalled()
  })

  it('treats iOS "inactive" as paused and an unresolved cold-start state as running', async () => {
    render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    await completeR3FBringUp()

    emitAppState('inactive')
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('never')

    // Android reports `null` before RN has resolved the state. That is a not-yet, not a background:
    // treating it as paused would leave a cold-started app on a blank canvas.
    spies.appState.currentState = null
    for (const listener of [...spies.appState.listeners]) {
      ;(listener as unknown as (status: string | null) => void)(null)
    }
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('always')
  })

  it('does not start rendering into a device brought up while backgrounded', async () => {
    spies.appState.currentState = 'background'

    render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    await completeR3FBringUp()

    // `configure` asks for 'always'; the initial read in `onCreated` is what corrects it, because
    // the subscription only ever sees CHANGES.
    expect(spies.setFrameloop).toHaveBeenLastCalledWith('never')
  })

  it('leaves no app-state listener behind on unmount', async () => {
    const view = render(<UniverseCanvas>{SCENE_A}</UniverseCanvas>)
    await vi.waitFor(() => expect(spies.appState.listeners.size).toBe(1))

    view.unmount()

    expect(spies.appState.listeners.size).toBe(0)
    expect(spies.appState.removals).toBe(1)
  })

  it('lowers the backing store on sustained slow frames without touching the device', async () => {
    render(<AdaptiveShell />)
    await vi.waitFor(() => expect(spies.renderers).toHaveLength(1))
    const device = spies.renderers[0]
    await completeR3FBringUp()
    // The mocked device reports PixelRatio 3, so the cap decides the ratio: it starts at 2.
    expect(spies.setDpr).toHaveBeenLastCalledWith(2)

    // A window of sustained 30 fps, through the real walk.
    const sampler = createAdaptiveDprSampler()
    let stepped: number | null = null
    for (let elapsed = 0; elapsed < 1.6 && stepped === null; elapsed += 1 / 30) {
      stepped = sampleAdaptiveDpr(sampler, 1 / 30, 2, {
        maxPixelRatio: 2,
        windowSeconds: VALUES.rendering.adaptiveDprWindowSeconds,
        downFps: VALUES.rendering.adaptiveDprDownFps,
        upFps: VALUES.rendering.adaptiveDprUpFps,
        step: VALUES.rendering.adaptiveDprStep,
        maxFlipflops: VALUES.rendering.adaptiveDprMaxFlipflops,
      })
    }
    expect(stepped).toBe(1.75)
    act(() => step.current(stepped as number))

    // The backing store shrank in place: the same renderer, the same root, no dispose and no
    // second `init` — the step went through the live-config effect, never the device effect.
    expect(spies.setDpr).toHaveBeenLastCalledWith(1.75)
    expect(spies.renderers).toHaveLength(1)
    expect(spies.renderers[0]).toBe(device)
    expect(spies.createRoot).toHaveBeenCalledTimes(1)
    expect(spies.dispose).not.toHaveBeenCalled()
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

// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// R3F's real <Canvas> measures its container with react-use-measure and configures nothing while
// the box is 0×0 — which is every element in jsdom — so the `gl` factory would never run and the
// host's renderer ref would stay null. The stub stands in for exactly the two things R3F does that
// this host's lifecycle depends on: it asks for a renderer once, and it unmounts.
const glFactoryCalls = vi.hoisted(() => ({ count: 0 }))

vi.mock('@react-three/fiber', async () => {
  const { useRef } = await import('react')
  return {
    extend: () => undefined,
    Canvas: ({
      gl,
      frameloop,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gl: (props: Record<string, unknown>) => any
      frameloop: string
    }) => {
      const renderer = useRef<unknown>(null)
      if (!renderer.current) {
        glFactoryCalls.count += 1
        renderer.current = gl({})
      }
      // Scene children are deliberately dropped: R3F renders them through its own reconciler into
      // the three scene graph, never into the DOM.
      return <div data-testid="r3f-canvas" data-frameloop={frameloop} />
    },
  }
})

const disposeSpy = vi.hoisted(() => vi.fn())

vi.mock('three/webgpu', () => {
  class WebGPURenderer {
    toneMapping = 0
    toneMappingExposure = 1
    dispose = disposeSpy
    setClearColor = vi.fn()
    init = vi.fn(async () => undefined)
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

const { UniverseCanvas } = await import('./UniverseCanvas.tsx')

describe('UniverseCanvas (web) device lifecycle', () => {
  beforeEach(() => {
    disposeSpy.mockClear()
    glFactoryCalls.count = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disposes the WebGPURenderer exactly once on unmount', async () => {
    const view = render(
      <UniverseCanvas>
        <group />
      </UniverseCanvas>,
    )
    expect(glFactoryCalls.count).toBe(1)
    expect(disposeSpy).not.toHaveBeenCalled()

    await act(async () => {})
    view.unmount()
    // The dispose is deferred one macrotask so StrictMode's simulated unmount can cancel it.
    vi.runAllTimers()
    expect(disposeSpy).toHaveBeenCalledTimes(1)

    // A second flush must not find another device to release.
    vi.runAllTimers()
    expect(disposeSpy).toHaveBeenCalledTimes(1)
  })

  it('does not dispose across a re-render', async () => {
    const view = render(
      <UniverseCanvas>
        <group />
      </UniverseCanvas>,
    )
    await act(async () => {})
    view.rerender(
      <UniverseCanvas>
        <mesh />
      </UniverseCanvas>,
    )
    vi.runAllTimers()
    expect(disposeSpy).not.toHaveBeenCalled()
  })

  it('survives StrictMode double-invoke without disposing the live device', async () => {
    // StrictMode runs the mount effect, its cleanup, then the body again — one commit, one instance,
    // so the cleanup's scheduled dispose must be cancelled by the re-mount. It has to be: R3F keeps
    // its root's `state.gl` across the double-invoke, and re-`configure` skips the `gl` factory
    // whenever a renderer already exists, so a device released here is never replaced.
    const view = render(
      <StrictMode>
        <UniverseCanvas>
          <group />
        </UniverseCanvas>
      </StrictMode>,
    )
    vi.runAllTimers()
    expect(disposeSpy).not.toHaveBeenCalled()

    await act(async () => {})
    view.unmount()
    vi.runAllTimers()
    expect(disposeSpy).toHaveBeenCalledTimes(1)
  })
})

describe('UniverseCanvas (web) active input', () => {
  beforeEach(() => {
    cleanup()
    disposeSpy.mockClear()
    glFactoryCalls.count = 0
  })

  // The host defers its dispose one macrotask; let it land before the next case clears the spy.
  afterEach(async () => {
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  const frameloop = (view: ReturnType<typeof render>) =>
    view.getByTestId('r3f-canvas').getAttribute('data-frameloop')

  it('renders nothing before init, then runs while active', async () => {
    const view = render(
      <UniverseCanvas>
        <group />
      </UniverseCanvas>,
    )
    expect(frameloop(view)).toBe('never')
    await act(async () => {})
    expect(frameloop(view)).toBe('always')
  })

  it('parks the loop while inactive and resumes on the same device', async () => {
    const view = render(
      <UniverseCanvas active={false}>
        <group />
      </UniverseCanvas>,
    )
    await act(async () => {})
    expect(frameloop(view)).toBe('never')

    view.rerender(
      <UniverseCanvas active>
        <group />
      </UniverseCanvas>,
    )
    expect(frameloop(view)).toBe('always')

    view.rerender(
      <UniverseCanvas active={false}>
        <group />
      </UniverseCanvas>,
    )
    expect(frameloop(view)).toBe('never')
    expect(glFactoryCalls.count).toBe(1)
    expect(disposeSpy).not.toHaveBeenCalled()
  })
})

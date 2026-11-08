// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// The renderer cannot run in jsdom; the stub stands in for the facts this page decides — whether a
// canvas exists, whether its loop is asked to run, and what the sky is handed.
const sky = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))
vi.mock('@cosimosi/3d-renderer', () => ({
  DEFAULT_STAR_SHAPE: 'star',
  STAR_INSTANCE_BRIGHTNESS: 'brightness',
  STAR_INSTANCE_SEED: 'seed',
  STAR_INSTANCE_SCALE: 'scale',
  STAR_INSTANCE_TINT: 'tint',
  InstancedNodeLayer: () => null,
  PostFX: () => null,
  SkySphere: (props: Record<string, unknown>) => {
    sky.props.push(props)
    return null
  },
  SkinProvider: ({ children }: { children: ReactNode }) => children,
  UniverseCanvas: ({ active, children }: { active?: boolean; children?: ReactNode }) => (
    <div data-testid="walkthrough-canvas" data-active={String(active ?? true)}>
      {children}
    </div>
  ),
  createStarShapeBodySource: () => ({}),
  resolveActiveSkin: () => 'default',
  useSkin: () => ({ skin: { camera: { fov: 50 }, sky: { night: 0, effect: 'none' }, bloom: {} } }),
}))

vi.mock('@cosimosi/observability/react', () => ({
  ObservedErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('@cosimosi/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cosimosi/ui')>()),
  useReducedMotion: () => motion.reduced,
}))

const { LandingWalkthroughScene } = await import('./LandingWalkthroughScene.tsx')

let intersect: ((isIntersecting: boolean) => void) | null = null
let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  sky.props = []
  motion.reduced = false
  visibility = 'visible'
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = (isIntersecting) => this.callback([{ isIntersecting }])
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})

afterEach(() => {
  cleanup()
  intersect = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderScene(skyFacing?: number) {
  return render(
    <LandingWalkthroughScene
      memories={[]}
      universeTime="2026-01-01T00:00:00Z"
      skyStops={[]}
      skyFacing={skyFacing}
    />,
  )
}

function setVisibility(next: DocumentVisibilityState) {
  act(() => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const canvas = () => screen.queryByTestId('walkthrough-canvas')

describe('LandingWalkthroughScene', () => {
  it('mounts no canvas before the stage first intersects', () => {
    renderScene()
    expect(canvas()).toBeNull()
    act(() => intersect?.(false))
    expect(canvas()).toBeNull()
  })

  it('mounts on first intersection and runs only while in view', () => {
    renderScene()
    act(() => intersect?.(true))
    expect(canvas()?.getAttribute('data-active')).toBe('true')

    // Scrolled past: the canvas stays mounted, parked.
    act(() => intersect?.(false))
    expect(canvas()?.getAttribute('data-active')).toBe('false')

    act(() => intersect?.(true))
    expect(canvas()?.getAttribute('data-active')).toBe('true')
  })

  it('parks while the document is hidden', () => {
    renderScene()
    act(() => intersect?.(true))
    setVisibility('hidden')
    expect(canvas()?.getAttribute('data-active')).toBe('false')
    setVisibility('visible')
    expect(canvas()?.getAttribute('data-active')).toBe('true')
  })

  it("hands the sky its facing, turning at the universe camera's focus pace", async () => {
    const { UNIVERSE_CAMERA_RIG } = await import('@cosimosi/universe/scene')
    renderScene(2)
    act(() => intersect?.(true))
    expect(sky.props.at(-1)).toMatchObject({
      facing: 2,
      facingLambda: UNIVERSE_CAMERA_RIG.glideLambda.focusing,
    })
  })

  it('leaves the sky unfaced when the step names no feeling', () => {
    renderScene()
    act(() => intersect?.(true))
    expect(sky.props.length).toBeGreaterThan(0)
    expect(sky.props.at(-1)?.facing).toBeUndefined()
  })

  it('shows the poster alone under reduced motion', () => {
    motion.reduced = true
    renderScene()
    act(() => intersect?.(true))
    expect(canvas()).toBeNull()
  })
})

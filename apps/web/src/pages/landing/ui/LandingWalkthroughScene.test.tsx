// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import { arousalToInitialStrength, createEmotion } from '@cosimosi/emotion'
import { starChannels } from '@cosimosi/universe/scene'

import type { EpisodicMemory } from '@cosimosi/memory'

// The renderer cannot run in jsdom; the stub stands in for the facts this page decides — whether a
// canvas exists, whether its loop is asked to run, what the sky is handed, and where the camera and
// the stars stand. The skin is the real active one, so the camera's field of view is the shipped one.
const sky = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
  canvas: [] as Record<string, unknown>[],
  layer: [] as Record<string, unknown>[],
}))
vi.mock('@cosimosi/3d-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cosimosi/3d-renderer')>()
  const { VALUES } = await import('@cosimosi/config')
  const skin = actual.UNIVERSE_SKINS[actual.resolveActiveSkin(VALUES.rendering.activeSkin)]
  return {
    DEFAULT_STAR_SHAPE: 'star',
    STAR_INSTANCE_BRIGHTNESS: 'brightness',
    STAR_INSTANCE_SEED: 'seed',
    STAR_INSTANCE_SCALE: 'scale',
    STAR_INSTANCE_TINT: 'tint',
    InstancedNodeLayer: (props: Record<string, unknown>) => {
      sky.layer.push(props)
      return null
    },
    PostFX: () => null,
    SkySphere: (props: Record<string, unknown>) => {
      sky.props.push(props)
      return null
    },
    SkinProvider: ({ children }: { children: ReactNode }) => children,
    UniverseCanvas: ({
      active,
      children,
      ...props
    }: {
      active?: boolean
      children?: ReactNode
    } & Record<string, unknown>) => {
      sky.canvas.push(props)
      return (
        <div data-testid="walkthrough-canvas" data-active={String(active ?? true)}>
          {children}
        </div>
      )
    },
    createStarShapeBodySource: () => ({}),
    resolveActiveSkin: () => 'default',
    useSkin: () => ({ skin }),
  }
})

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
  sky.canvas = []
  sky.layer = []
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

describe('the staged slots', () => {
  // The narrowest stage the page lays out: a 360px-wide phone gives the stage about 0.98.
  const NARROWEST_ASPECT = 0.95

  // One fresh memory per slot: the slots, not the story, are under test, so the memories carry only
  // what the channel projection reads, and the size ceiling below covers any strength they reach.
  function slotMemory(index: number): EpisodicMemory {
    const emotion = createEmotion('CALM')
    return {
      id: `landing-walk-slot-${index}`,
      diaryId: `landing-walk-slot-${index}-diary`,
      name: `slot ${index}`,
      emotion,
      baseStrength: arousalToInitialStrength(emotion.arousal),
      recallCount: 0,
      createdUniverseTime: '2026-01-01',
      lastRecalledUniverseTime: null,
      seed: BigInt(index),
      activations: [],
      decayStages: [],
      forgettingOffsetDays: 0,
      currentText: `slot ${index}`,
      semanticStage: 0,
    }
  }

  /**
   * Whether a ball of `radius` at lateral offset `offset` and `depth` in front of the camera lies
   * inside the two side planes of a frustum whose half-angle on that axis is `halfAngle`. A plane
   * through the eye at that angle is `radius / cos(halfAngle)` from the centre measured along the
   * offset axis, so the bound is exact rather than read at the centre's depth alone.
   */
  function insideSidePlanes(offset: number, depth: number, radius: number, halfAngle: number) {
    return Math.abs(offset) + radius / Math.cos(halfAngle) <= depth * Math.tan(halfAngle)
  }

  function renderEverySlot() {
    const universeTime = '2026-01-01'
    const memories = Array.from({ length: 8 }, (_, index) => slotMemory(index))
    const view = render(
      <LandingWalkthroughScene
        memories={memories}
        universeTime={universeTime}
        skyStops={[]}
        skyFacing={undefined}
      />,
    )
    act(() => intersect?.(true))
    return { view, memories, universeTime }
  }

  it('keep every star, at its largest rendered body, inside a phone-width frame', () => {
    const { memories, universeTime } = renderEverySlot()
    const camera = sky.canvas.at(-1) as { fov: number; cameraPosition: readonly number[] }
    const layer = sky.layer.at(-1) as {
      positions: { current: Float32Array }
      channels: { scales: Float32Array }
    }
    expect(memories).toHaveLength(8)

    const vertical = ((camera.fov / 2) * Math.PI) / 180
    const horizontal = Math.atan(Math.tan(vertical) * NARROWEST_ASPECT)
    // Bodies are authored at unit radius and scaled by the star's size channel times the scene's
    // group scale, so the largest body is the size ceiling at that same scale.
    const groupScale = layer.channels.scales[0] / starChannels(memories[0], universeTime).size
    const radius = VALUES.rendering.starSizeMax * groupScale
    const [cameraX, cameraY, cameraZ] = camera.cameraPosition
    expect([cameraX, cameraY]).toEqual([0, 0])

    for (let index = 0; index < memories.length; index++) {
      const [x, y, z] = layer.positions.current.slice(index * 3, index * 3 + 3)
      const depth = cameraZ - z
      expect(insideSidePlanes(x, depth, radius, horizontal), `slot ${index} width`).toBe(true)
      expect(insideSidePlanes(y, depth, radius, vertical), `slot ${index} height`).toBe(true)
    }
  })

  it('bound a body against the slanted side plane, not the extent at its centre', () => {
    // A body that clears the half-extent at its centre's depth by a hair still crosses the plane.
    const halfAngle = Math.atan(Math.tan((27.5 * Math.PI) / 180) * NARROWEST_ASPECT)
    const depth = 54
    const radius = 3.84
    const grazing = depth * Math.tan(halfAngle) - radius - 0.01
    expect(insideSidePlanes(grazing, depth, radius, halfAngle)).toBe(false)
    expect(insideSidePlanes(grazing - radius, depth, radius, halfAngle)).toBe(true)
  })

  it('put each poster dot on the same side of the frame as its star', () => {
    const { view } = renderEverySlot()
    const layer = sky.layer.at(-1) as { positions: { current: Float32Array } }
    const dots = [...view.container.querySelectorAll<HTMLElement>('.rounded-full')]
    expect(dots).toHaveLength(8)
    dots.forEach((dot, index) => {
      const [x, y] = layer.positions.current.slice(index * 3, index * 3 + 2)
      expect(Math.sign(Number.parseFloat(dot.style.left) - 50), `dot ${index}`).toBe(Math.sign(x))
      expect(Math.sign(50 - Number.parseFloat(dot.style.top)), `dot ${index}`).toBe(Math.sign(y))
    })
  })
})

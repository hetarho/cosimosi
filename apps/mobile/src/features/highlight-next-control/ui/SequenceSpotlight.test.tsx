import { render } from '@testing-library/react-native'
import { Animated, StyleSheet } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { useReducedMotion } from '@cosimosi/ui'

import { SequenceSpotlight } from './SequenceSpotlight.tsx'

// Only the motion preference is stubbed, the same seam the web suite stubs; everything else — the real
// tokens, the real StyleSheet, the real Animated — stays. The native hook reads AccessibilityInfo
// asynchronously, and a hook under test that settles on a microtask would make every case await.
jest.mock('@cosimosi/ui', () => ({
  ...jest.requireActual('@cosimosi/ui'),
  useReducedMotion: jest.fn(),
}))

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>

const RECT = { x: 40, y: 120, width: 200, height: 48 }
const RING_PADDING = 8

// Real loops, observed. `Animated.loop` is wrapped rather than replaced so the component drives a
// genuine animation and the handles it is given are the ones asserted against — a stub returning
// `{ start, stop }` would pass even if the production code stopped composing a real loop.
type LoopHandle = Animated.CompositeAnimation
let loopSpy: jest.SpyInstance
let loops: LoopHandle[]
let stops: LoopHandle[]

beforeEach(() => {
  mockUseReducedMotion.mockReset()
  mockUseReducedMotion.mockReturnValue(false)
  loops = []
  stops = []
  const actualLoop = Animated.loop.bind(Animated)
  loopSpy = jest.spyOn(Animated, 'loop').mockImplementation((animation, config) => {
    const handle = actualLoop(animation, config)
    const stop = handle.stop.bind(handle)
    handle.stop = () => {
      stops.push(handle)
      stop()
    }
    loops.push(handle)
    return handle
  })
})

afterEach(() => {
  // Restored here rather than at the end of each test, so a failing assertion cannot leak the spy —
  // or a still-driving animation — into the next case.
  for (const handle of loops) handle.stop()
  loopSpy.mockRestore()
})

/** The ring's own style, flattened out of the `[styles.ring, measured]` array the component passes. */
function ringStyle(view: ReturnType<typeof render>) {
  const tree = view.toJSON()
  if (tree === null || Array.isArray(tree)) throw new Error('expected a single rendered ring')
  return StyleSheet.flatten(tree.props.style as never) as Record<string, unknown>
}

describe('SequenceSpotlight (mobile)', () => {
  it('is decorative and never takes over the screen (A9)', () => {
    const view = render(<SequenceSpotlight rect={RECT} />)
    const tree = view.toJSON()
    if (tree === null || Array.isArray(tree)) throw new Error('expected a single rendered ring')
    // The three properties that make the chrome non-modal: it cannot be hit, it is not announced, and
    // it draws no backdrop. Nothing here can disable or defocus the control it circles.
    expect(tree.props.pointerEvents).toBe('none')
    expect(tree.props.accessibilityElementsHidden).toBe(true)
    expect(tree.props.importantForAccessibility).toBe('no-hide-descendants')
  })

  it('stands the ring off the measured rect on both axes', () => {
    const style = ringStyle(render(<SequenceSpotlight rect={RECT} />))
    expect(style.left).toBe(RECT.x - RING_PADDING)
    expect(style.top).toBe(RECT.y - RING_PADDING)
    // Both sides, so the control sits centred inside the ring rather than offset within it.
    expect(style.width).toBe(RECT.width + RING_PADDING * 2)
    expect(style.height).toBe(RECT.height + RING_PADDING * 2)
  })

  it('pulses at the tuned period, split across the two legs', () => {
    const timing = jest.spyOn(Animated, 'timing')
    try {
      render(<SequenceSpotlight rect={RECT} />)
      expect(loops).toHaveLength(1)
      // Down then back up, each half of the period, so one full cycle is the tuned value.
      const durations = timing.mock.calls.map(([, config]) => config.duration)
      expect(durations).toEqual([
        VALUES.sequence.highlightPulseMs / 2,
        VALUES.sequence.highlightPulseMs / 2,
      ])
    } finally {
      timing.mockRestore()
    }
  })

  it('collapses to a static ring under reduced motion (A9)', () => {
    mockUseReducedMotion.mockReturnValue(true)
    const view = render(<SequenceSpotlight rect={RECT} />)
    // A plain number, not a driven value: the ring stays put rather than animating to a resting state.
    expect(ringStyle(view).opacity).toBe(1)
    expect(loops).toHaveLength(0)
    // The ring itself stays — the pulse draws the eye, but the ring is what says "here".
    expect(ringStyle(view).borderWidth).toBe(2)
  })

  it('renders nothing at all when the anchor could not be measured (A10)', () => {
    // Not an error state, and no timeout: the caption is the guaranteed channel, so an unresolvable
    // anchor simply leaves the highlight out and the run stays completable.
    const view = render(<SequenceSpotlight rect={null} />)
    expect(view.toJSON()).toBeNull()
    expect(loops).toHaveLength(0)
  })

  // The case the web fork cannot express, and the reason this suite exists. RN's animation lifecycle is
  // imperative, so a missing teardown leaves a loop driving a view that is gone — and it would not
  // surface as a pending-timer failure either, because a `useNativeDriver: true` loop registers no JS
  // timer. Nothing but this test stands between that and a silent leak.
  it('stops the animation when the highlight unmounts', () => {
    const view = render(<SequenceSpotlight rect={RECT} />)
    expect(loops).toHaveLength(1)
    expect(stops).toHaveLength(0)

    view.unmount()
    expect(stops).toEqual(loops)
  })

  it.each([
    ['a new rect', () => ({ rect: { ...RECT, y: 400 } })],
    ['a rect that disappears', () => ({ rect: null })],
  ])('stops the previous loop before starting another on %s', (_case, next) => {
    const view = render(<SequenceSpotlight rect={RECT} />)
    const first = loops[0]

    view.update(<SequenceSpotlight {...next()} />)
    // Stopped, and stopped BEFORE any replacement exists — two loops driving one opacity is the leak
    // this asserts against, not merely a loop that is eventually cleaned up.
    expect(stops).toContain(first)
    expect(loops.filter((loop) => !stops.includes(loop))).toHaveLength(next().rect ? 1 : 0)
  })

  it('stops the previous loop when the motion preference turns on', () => {
    const view = render(<SequenceSpotlight rect={RECT} />)
    const first = loops[0]

    mockUseReducedMotion.mockReturnValue(true)
    view.update(<SequenceSpotlight rect={RECT} />)
    expect(stops).toContain(first)
    expect(loops).toHaveLength(1)
  })
})

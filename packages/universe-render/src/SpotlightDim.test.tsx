// @vitest-environment jsdom
import { StrictMode, type MutableRefObject } from 'react'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SPOTLIGHT_SCENE_DIM, useSpotlightStore } from '@cosimosi/universe'

const renderer = vi.hoisted(() => ({
  onFrame: null as ((delta: number) => void) | null,
  exposure: null as MutableRefObject<number> | null,
}))

vi.mock('@cosimosi/3d-renderer', () => ({
  FrameTick: ({ onFrame }: { readonly onFrame: (delta: number) => void }) => {
    renderer.onFrame = onFrame
    return null
  },
  SceneExposure: ({ scaleRef }: { readonly scaleRef: MutableRefObject<number> }) => {
    renderer.exposure = scaleRef
    return null
  },
}))

import { SpotlightDim } from './SpotlightDim.tsx'

describe('SpotlightDim lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSpotlightStore.getState().clear()
    renderer.onFrame = null
    renderer.exposure = null
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    useSpotlightStore.getState().clear()
  })

  it('keeps a diary-armed spotlight through StrictMode cleanup and still plays the dim', () => {
    useSpotlightStore.getState().spotlight(['memory-a'])

    const view = render(
      <StrictMode>
        <SpotlightDim reducedMotion />
      </StrictMode>,
    )
    vi.runAllTimers()

    expect(useSpotlightStore.getState().memoryIds).toEqual(['memory-a'])
    act(() => renderer.onFrame?.(1 / 60))
    expect(renderer.exposure?.current).toBe(SPOTLIGHT_SCENE_DIM)

    view.unmount()
    vi.runAllTimers()
    expect(useSpotlightStore.getState().memoryIds).toEqual([])
  })
})

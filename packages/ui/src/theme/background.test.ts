import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getBackgroundState,
  resetBackground,
  setBackground,
  subscribeBackground,
} from './background-store.ts'

afterEach(() => resetBackground())

describe('background seam', () => {
  it('defaults to cosmos', () => {
    expect(getBackgroundState()).toEqual({ tone: 'cosmos' })
  })

  it('updates the descriptor and notifies subscribers, stopping after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBackground(listener)
    setBackground({ tone: 'plain' })
    expect(getBackgroundState().tone).toBe('plain')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setBackground({ tone: 'cosmos' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('carries a presentation-only accent drawn from the token palette', () => {
    setBackground({ tone: 'plain', accent: 'primary' })
    expect(getBackgroundState()).toEqual({ tone: 'plain', accent: 'primary' })
  })
})

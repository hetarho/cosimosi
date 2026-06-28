import { afterEach, describe, expect, it, vi } from 'vitest'

import { getThemeState, resetTheme, setBackground, setTheme, subscribeTheme } from './theme-store.ts'

afterEach(() => resetTheme())

describe('theme/background seam (A7)', () => {
  it('defaults to dark / cosmos', () => {
    expect(getThemeState()).toEqual({ theme: 'dark', background: { tone: 'cosmos' } })
  })

  it('updates the theme and notifies subscribers, stopping after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    setTheme('light')
    expect(getThemeState().theme).toBe('light')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('sets a presentation-only background descriptor', () => {
    setBackground({ tone: 'plain', accent: 'primary' })
    expect(getThemeState().background).toEqual({ tone: 'plain', accent: 'primary' })
  })
})

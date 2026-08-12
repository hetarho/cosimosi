// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UNIVERSE_DEFAULT_VIEW_MODE, useUniverseViewStore } from '@cosimosi/universe'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'
import { UniverseViewToggle } from './UniverseViewToggle.tsx'

beforeEach(() => {
  useUniverseViewStore.getState().choose(UNIVERSE_DEFAULT_VIEW_MODE)
})

afterEach(() => {
  cleanup()
  setActiveLocale(defaultLocale)
})

describe('UniverseViewToggle', () => {
  it('names the mode the universe is in, in words as well as in a glyph', () => {
    render(<UniverseViewToggle />)

    expect(screen.getByText(m.universe_view_pinned())).toBeTruthy()
  })

  it('hands the universe between the two modes, and says which one it is now in', async () => {
    const user = userEvent.setup()
    render(<UniverseViewToggle />)

    // The accessible name is what pressing DOES, so the button announces the change it makes rather
    // than the state a sighted viewer already reads from the glyph and the word beside it.
    await user.click(screen.getByRole('button', { name: m.universe_view_free_action() }))

    expect(useUniverseViewStore.getState().mode).toBe('free')
    expect(screen.getByText(m.universe_view_free())).toBeTruthy()

    await user.click(screen.getByRole('button', { name: m.universe_view_pin_action() }))

    expect(useUniverseViewStore.getState().mode).toBe('pinned')
  })

  it('carries the pressed state for a reader who never sees the fill', () => {
    render(<UniverseViewToggle />)

    expect(
      screen
        .getByRole('button', { name: m.universe_view_free_action() })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

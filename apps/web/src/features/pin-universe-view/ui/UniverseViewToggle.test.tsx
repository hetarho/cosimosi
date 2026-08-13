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
  it('names the mode the universe is in, in words as well as in a glyph — inside ONE control', () => {
    render(<UniverseViewToggle />)

    const control = screen.getByRole('button')
    // The word is the button's own content, not a caption beside it: pressing where it says
    // 고정 모드 has to be pressing the control.
    expect(control.textContent).toContain(m.universe_view_pinned())
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('hands the universe between the two modes, and says which one it is now in', async () => {
    const user = userEvent.setup()
    render(<UniverseViewToggle />)

    // The name carries BOTH: the mode printed on the control (so a voice user can say what they see)
    // and what pressing it does.
    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`${m.universe_view_pinned()}.*${m.universe_view_free_action()}`),
      }),
    )

    expect(useUniverseViewStore.getState().mode).toBe('free')
    expect(screen.getByRole('button').textContent).toContain(m.universe_view_free())

    await user.click(screen.getByRole('button', { name: new RegExp(m.universe_view_pin_action()) }))

    expect(useUniverseViewStore.getState().mode).toBe('pinned')
  })

  it('carries the pressed state for a reader who never sees the fill', () => {
    render(<UniverseViewToggle />)

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('spends the hover on the consequence, not on a second copy of the name it already shows', async () => {
    const user = userEvent.setup()
    render(<UniverseViewToggle />)

    await user.hover(screen.getByRole('button'))

    // Pinned now, so the tip says what the OTHER way of holding the universe would let you do.
    expect(screen.getByRole('tooltip').textContent).toBe(m.universe_view_free_hint())
  })
})

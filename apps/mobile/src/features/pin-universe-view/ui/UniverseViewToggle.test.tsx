import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { UNIVERSE_DEFAULT_VIEW_MODE, useUniverseViewStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'
import { UniverseViewToggle } from './UniverseViewToggle.tsx'

beforeEach(() => useUniverseViewStore.getState().choose(UNIVERSE_DEFAULT_VIEW_MODE))
afterEach(() => setActiveLocale(defaultLocale))

describe('UniverseViewToggle (mobile)', () => {
  it('keeps the visible state word in the control name while toggling modes', () => {
    const view = render(<UniverseViewToggle />)
    const pinnedName = `${m.universe_view_pinned()}. ${m.universe_view_free_action()}`

    fireEvent.press(view.getByRole('button', { name: pinnedName }))

    expect(useUniverseViewStore.getState().mode).toBe('free')
    expect(
      view.getByRole('button', {
        name: `${m.universe_view_free()}. ${m.universe_view_pin_action()}`,
      }),
    ).toBeTruthy()
  })
})

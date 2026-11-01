import { render } from '@testing-library/react-native'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { CurrentMemoryText } from './CurrentMemoryText.tsx'

// A3, RN fork: a pure read — the component takes resolved spans and renders them, no
// transport/query/mutation (viewing is free and moves no clock, by construction).
describe('CurrentMemoryText (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders the supplied text', () => {
    const view = render(
      <CurrentMemoryText spans={[{ text: 'a quiet market morning', lost: false }]} />,
    )
    expect(view.getByText('a quiet market morning')).toBeTruthy()
  })

  it('keeps a lost run in the line rather than dropping it', () => {
    const view = render(
      <CurrentMemoryText
        spans={[
          { text: 'a quiet ', lost: false },
          { text: 'xxxx', lost: true },
          { text: ' morning', lost: false },
        ]}
      />,
    )
    expect(view.getByText('xxxx')).toBeTruthy()
    expect(view.getByText('a quiet ')).toBeTruthy()
  })

  it('shows the unavailable note when no text source is wired yet', () => {
    const view = render(<CurrentMemoryText spans={null} />)
    expect(view.getByText(m.star_detail_text_unavailable())).toBeTruthy()
  })
})

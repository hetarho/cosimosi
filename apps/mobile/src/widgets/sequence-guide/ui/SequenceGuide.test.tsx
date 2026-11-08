import { Dimensions, StyleSheet } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { CAPTION_EDGE_INSET_PX } from '@cosimosi/sequence'

import { CAPTION_BAND_HEIGHT } from './SequenceCaption.tsx'
import { SequenceGuide, type SequenceGuideProps } from './SequenceGuide.tsx'

const NOTCHED = { top: 59, right: 0, bottom: 34, left: 0 }

function mount(overrides: Partial<SequenceGuideProps> = {}) {
  return render(
    <SequenceGuide
      active
      caption={() => 'Write one line about today.'}
      anchorRect={{ x: 40, y: 120, width: 200, height: 48 }}
      progress={{ current: 3, total: 10 }}
      onSkip={jest.fn()}
      onRemeasure={jest.fn()}
      {...overrides}
    />,
  )
}

describe('SequenceGuide (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('shows the caption and the skip while a run is active', () => {
    const view = mount()
    expect(view.getByText('Write one line about today.')).toBeTruthy()
    expect(view.getByText(m.sequence_skip_action())).toBeTruthy()
    expect(view.getByText(m.sequence_progress({ current: 3, total: 10 }))).toBeTruthy()
  })

  it('keeps the run escapable on a step with no highlight (A7/A10)', () => {
    const onSkip = jest.fn()
    const view = mount({ anchorRect: null, onSkip })
    expect(view.getByText('Write one line about today.')).toBeTruthy()
    fireEvent.press(view.getByText(m.sequence_skip_action()))
    // One press, no confirmation dialog to dismiss first.
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('breaks Korean captions between words on iOS', () => {
    const view = mount()
    expect(view.getByText('Write one line about today.').props.lineBreakStrategyIOS).toBe(
      'hangul-word',
    )
  })

  it('renders no chrome at all when no run is active', () => {
    const view = mount({ active: false })
    expect(view.queryByText(m.sequence_skip_action())).toBeNull()
  })

  it('places the skip below the status bar inset of a notched phone and clears its right inset', () => {
    const view = render(
      <SafeAreaInsetsContext.Provider value={{ ...NOTCHED, right: 12 }}>
        <SequenceGuide
          active
          caption={() => 'Write one line about today.'}
          anchorRect={null}
          progress={{ current: 1, total: 9 }}
          onSkip={jest.fn()}
          onRemeasure={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>,
    )
    const bar = StyleSheet.flatten(view.getByTestId('sequence-skip').props.style)
    const flat = StyleSheet.flatten(
      mount({ anchorRect: null }).getByTestId('sequence-skip').props.style,
    )
    expect(bar.top).toBe(NOTCHED.top + flat.top)
    expect(bar.right).toBe(12 + flat.right)
  })

  it('keeps a top-band caption below the same inset', () => {
    // A highlight crossing the bottom band sends the caption to the top band.
    const bottomAnchor = { x: 40, y: 1200, width: 200, height: 48 }
    const notched = render(
      <SafeAreaInsetsContext.Provider value={NOTCHED}>
        <SequenceGuide
          active
          caption={() => 'Write one line about today.'}
          anchorRect={bottomAnchor}
          progress={{ current: 1, total: 9 }}
          onSkip={jest.fn()}
          onRemeasure={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>,
    )
    const bare = mount({ anchorRect: bottomAnchor })
    const band = (view: ReturnType<typeof render>) =>
      StyleSheet.flatten(view.getByText('Write one line about today.').parent?.parent?.props.style)
    const flatTop = band(bare).top
    expect(typeof flatTop).toBe('number')
    expect(band(notched).top).toBe(NOTCHED.top + (flatTop as number))
  })

  it('lifts a bottom-band caption above the home indicator', () => {
    const notched = render(
      <SafeAreaInsetsContext.Provider value={NOTCHED}>
        <SequenceGuide
          active
          caption={() => 'Write one line about today.'}
          anchorRect={null}
          progress={{ current: 1, total: 9 }}
          onSkip={jest.fn()}
          onRemeasure={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>,
    )
    const bare = mount({ anchorRect: null })
    const band = (view: ReturnType<typeof render>) =>
      StyleSheet.flatten(view.getByText('Write one line about today.').parent?.parent?.props.style)
    const flatBottom = band(bare).bottom
    expect(typeof flatBottom).toBe('number')
    expect(band(notched).bottom).toBe(NOTCHED.bottom + (flatBottom as number))
  })

  it('moves the caption to the top when the highlight crosses the lifted bottom band', () => {
    // Clear of the band on a bare screen, but inside it once the band rises by the home indicator.
    const bareBandTop =
      Dimensions.get('window').height - (CAPTION_BAND_HEIGHT + CAPTION_EDGE_INSET_PX)
    const anchorRect = { x: 40, y: bareBandTop - 48 - 10, width: 200, height: 48 }
    const notched = render(
      <SafeAreaInsetsContext.Provider value={NOTCHED}>
        <SequenceGuide
          active
          caption={() => 'Write one line about today.'}
          anchorRect={anchorRect}
          progress={{ current: 1, total: 9 }}
          onSkip={jest.fn()}
          onRemeasure={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>,
    )
    const bare = mount({ anchorRect })
    const band = (view: ReturnType<typeof render>) =>
      StyleSheet.flatten(view.getByText('Write one line about today.').parent?.parent?.props.style)
    expect(band(bare).bottom).toBeDefined()
    expect(band(notched).top).toBeDefined()
    expect(band(notched).bottom).toBeUndefined()
  })
})

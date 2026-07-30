import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { SequenceGuide, type SequenceGuideProps } from './SequenceGuide.tsx'

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

  it('renders no chrome at all when no run is active', () => {
    const view = mount({ active: false })
    expect(view.queryByText(m.sequence_skip_action())).toBeNull()
  })
})

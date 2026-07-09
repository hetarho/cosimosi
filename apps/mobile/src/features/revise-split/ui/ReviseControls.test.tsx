import { render } from '@testing-library/react-native'
import { TextInput } from 'react-native'

import { MOODS } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { ReviseControls, type EditableMemoryView } from './ReviseControls.tsx'

// The RN counterpart of the web ReviseControls test: both pin the [W4a][I3] editable-surface
// invariant against the *rendered control set* — the only mutable fields are name, emotion
// (a bounded selection of MOODS), and neuron membership. Neither platform may expose a control that
// sets a memory's strength / position / color / time. Web asserts the DOM control set; this asserts
// the RN control set, so the mobile Pressable fork can no longer drift a scalar control in unseen.

const memories: EditableMemoryView[] = [
  { id: 'a', name: 'Morning', mood: 'JOY', neurons: [{ name: 'cafe' }] },
]

const noop = () => {}

describe('ReviseControls editable surface (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('exposes only name / emotion selection / neuron membership — no strength/position/time control', () => {
    const view = render(
      <ReviseControls
        memories={memories}
        onRename={noop}
        onSetMood={noop}
        onMerge={noop}
        onSplit={noop}
        onRevise={noop}
      />,
    )

    // Name is editable text; neuron membership is shown as read-only text.
    expect(view.getByDisplayValue('Morning')).toBeTruthy()
    expect(view.getByText(/cafe/)).toBeTruthy()

    // Emotion is a *bounded selection* of the fixed mood set: one selectable chip per mood (they
    // are the buttons carrying a `selected` state), with exactly one currently selected. A
    // pick-from-set control, never a free scalar.
    const moodChips = view
      .getAllByRole('button')
      .filter((node) => node.props.accessibilityState?.selected !== undefined)
    expect(moodChips).toHaveLength(MOODS.length)
    expect(moodChips.filter((node) => node.props.accessibilityState.selected)).toHaveLength(1)

    // The closed surface: nothing adjustable (slider/stepper) exists, and no text field takes a
    // numeric/date entry — the RN affordances that could set strength/position/time.
    expect(view.queryAllByRole('adjustable')).toHaveLength(0)
    for (const input of view.UNSAFE_queryAllByType(TextInput)) {
      const keyboardType = input.props.keyboardType ?? 'default'
      expect(['numeric', 'number-pad', 'decimal-pad', 'phone-pad']).not.toContain(keyboardType)
    }
  })
})

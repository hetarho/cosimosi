import { render, userEvent } from '@testing-library/react-native'
import { TextInput } from 'react-native'

import { MOODS } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { ReviseControls, type EditableMemoryView } from './ReviseControls.tsx'

// The RN counterpart of the web ReviseControls test: both pin the [W4a][I3] editable-surface
// invariant against the *rendered control set* — the only mutable fields are name, emotion
// (a bounded selection of MOODS), the diary passage, and neuron membership. Neither platform may
// expose a control that
// set a memory's strength / position / color / time. Web asserts the DOM control set; this asserts
// the RN control set, so the mobile Pressable fork can no longer drift a scalar control in unseen.

const memories: EditableMemoryView[] = [
  {
    id: 'a',
    name: 'Morning',
    mood: 'JOY',
    sourceText: 'The cafe was quiet.',
    neurons: [{ name: 'cafe' }],
  },
]

const noop = () => {}

describe('ReviseControls editable surface (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('exposes only name / emotion selection / neuron membership — no strength/position/time control', async () => {
    const user = userEvent.setup()
    const view = render(
      <ReviseControls
        memories={memories}
        onRename={noop}
        onSetSourceText={noop}
        onSetMood={noop}
        onMerge={noop}
        onSplit={noop}
        onRevise={noop}
      />,
    )

    // Name is editable text; neuron membership is shown as read-only text.
    expect(view.getByDisplayValue('Morning')).toBeTruthy()
    expect(view.getByText(/cafe/)).toBeTruthy()

    // Emotion is a *bounded selection* of the fixed mood set. The affordance is a picker now, so the
    // probe follows it through the trigger into its option list — the set has to be provably the whole
    // set and nothing more, whatever the control looks like.
    const trigger = view.getByLabelText(m.writing_flow_emotion_label())
    expect(trigger.props.accessibilityState?.expanded).toBe(false)
    await user.press(trigger)

    const options = view
      .getAllByRole('button')
      .filter((node) => node.props.accessibilityState?.selected !== undefined)
    expect(options).toHaveLength(MOODS.length)
    expect(options.filter((node) => node.props.accessibilityState.selected)).toHaveLength(1)

    // The closed surface: nothing adjustable (slider/stepper) exists, and no text field takes a
    // numeric/date entry — the RN affordances that could set strength/position/time.
    expect(view.queryAllByRole('adjustable')).toHaveLength(0)
    for (const input of view.UNSAFE_queryAllByType(TextInput)) {
      const keyboardType = input.props.keyboardType ?? 'default'
      expect(['numeric', 'number-pad', 'decimal-pad', 'phone-pad']).not.toContain(keyboardType)
    }
  })
})

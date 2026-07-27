import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { MOODS } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '../../../shared/i18n/index.ts'

import { ReviseControls, type EditableMemoryView } from './ReviseControls.tsx'

const memories: EditableMemoryView[] = [
  {
    id: 'a',
    name: 'Morning',
    mood: 'JOY',
    sourceText: 'The cafe was quiet.',
    neurons: [{ name: 'cafe' }],
  },
  {
    id: 'b',
    name: 'Meeting',
    mood: 'STRESS',
    sourceText: 'The office meeting ran long.',
    neurons: [{ name: 'office' }],
  },
]

const noop = () => {}

// The web half of the [W4a][I3] editable-surface invariant: the only mutable fields are name,
// emotion (a bounded selection of MOODS), the diary passage, and neuron membership — never a
// control that sets a memory's strength / position / color / time. The mobile Pressable fork asserts the same control
// set in its own ReviseControls.test.tsx so the invariant holds on both platforms.
describe('ReviseControls editable surface', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('exposes only name / emotion selection / neuron membership — nothing for position/color/strength/time', () => {
    const html = renderToString(
      createElement(ReviseControls, {
        memories,
        onRename: noop,
        onSetMood: noop,
        onSetSourceText: noop,
        onMerge: noop,
        onSplit: noop,
        onRevise: noop,
      }),
    )
    // The allowed control set: name is editable text, emotion is a bounded <select> offering exactly
    // the fixed mood set (one <option> per mood, per rendered memory), and neuron membership is shown.
    // The assertion is on the RENDERED control set, not on how the slice builds it — the picker comes
    // from the design system now, and [W4a][I3] has to hold whatever the affordance is made of.
    expect(html).toContain('value="Morning"')
    expect(html).toContain('<select')
    expect((html.match(/<option/g) ?? []).length).toBe(MOODS.length * memories.length)
    expect(html).toContain('office')
    // The closed boundary: no continuous-scalar affordance — nothing that could set strength /
    // position / time / color (a range, numeric, date, or color input) exists anywhere.
    expect(html).not.toContain('type="range"')
    expect(html).not.toContain('type="number"')
    expect(html).not.toContain('type="date"')
    expect(html).not.toContain('type="color"')
  })
})

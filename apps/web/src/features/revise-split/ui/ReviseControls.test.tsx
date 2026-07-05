import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { ReviseControls, type EditableMemoryView } from './ReviseControls.tsx'

const memories: EditableMemoryView[] = [
  { id: 'a', name: 'Morning', mood: 'JOY', neurons: [{ name: 'cafe' }] },
  { id: 'b', name: 'Meeting', mood: 'STRESS', neurons: [{ name: 'office' }] },
]

const noop = () => {}

describe('ReviseControls editable surface', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('exposes only name / emotion / neuron membership — nothing for position/color/strength/time', () => {
    const html = renderToString(
      createElement(ReviseControls, {
        memories,
        onRename: noop,
        onSetMood: noop,
        onMerge: noop,
        onSplit: noop,
        onRevise: noop,
      }),
    )
    // Name field + a mood selection are present; neuron membership is shown.
    expect(html).toContain('value="Morning"')
    expect(html).toContain('<select')
    expect(html).toContain('<option')
    expect(html).toContain('office')
    // The schema-forced boundary ([W4a][I3]): there is structurally no control that could set a
    // memory's strength / position / time — no numeric, range, or date inputs anywhere.
    expect(html).not.toContain('type="range"')
    expect(html).not.toContain('type="number"')
    expect(html).not.toContain('type="date"')
  })
})

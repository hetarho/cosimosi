import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { createEmotion } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'

import { m, moodLabel } from '../../../shared/i18n/index.ts'
import { MetaBlock } from './MetaBlock.tsx'

const memory = {
  id: 'm1',
  name: 'Market run',
  emotion: createEmotion('JOY'),
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-06-20',
  lastRecalledUniverseTime: null,
  seed: 123n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'a memory',
  semanticStage: 0,
} as EpisodicMemory

const neuron: Neuron = { id: 'n1', name: 'market', neuronType: 'spatial', connectivity: 3 }

// A2 [D1][I3]: an episodic star shows its emotion; a neuron shows information only, NO emotion —
// the mobile fork asserts the same in its own MetaBlock.test.tsx so the invariant holds on both.
describe('MetaBlock', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('shows an episodic star with its emotion, written date, and a seed-driven glyph', () => {
    const html = renderToString(
      createElement(MetaBlock, {
        selection: { kind: 'episodic', memory },
        universeTime: '2026-06-25',
      }),
    )
    expect(html).toContain(moodLabel('JOY'))
    expect(html).toContain('2026-06-20')
    // The seed-driven glyph is present (rotate transform); the value comes from the seed alone.
    expect(html).toContain('rotate(')
  })

  it('shows the current forgetting degree — vivid when fresh, deeper as it fades [F1][D1]', () => {
    const fresh = renderToString(
      createElement(MetaBlock, {
        selection: { kind: 'episodic', memory },
        universeTime: '2026-06-20',
      }),
    )
    expect(fresh).toContain(m.star_meta_forgetting_vivid())

    const faded = renderToString(
      createElement(MetaBlock, {
        selection: { kind: 'episodic', memory },
        universeTime: '2035-06-20',
      }),
    )
    expect(faded).not.toContain(m.star_meta_forgetting_vivid())
    expect(faded).toContain(m.star_meta_forgetting_distant())
  })

  it('shows a neuron with info only and NO emotion / no glyph', () => {
    const html = renderToString(
      createElement(MetaBlock, { selection: { kind: 'neuron', neuron }, universeTime: null }),
    )
    expect(html).toContain('market')
    expect(html).toContain('3')
    // No emotion label and no star glyph — a neuron carries no mood ([I3]).
    expect(html).not.toContain(moodLabel('JOY'))
    expect(html).not.toContain('rotate(')
  })
})

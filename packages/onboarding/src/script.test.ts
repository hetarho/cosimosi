import { setActiveLocale, supportedLocales } from '@cosimosi/i18n'
import { afterEach, describe, expect, it } from 'vitest'

import { ONBOARDING_SCRIPT } from './script.ts'

afterEach(() => {
  setActiveLocale('en')
})

describe('the onboarding script', () => {
  it('walks the nine steps in order', () => {
    expect(ONBOARDING_SCRIPT.steps.map((step) => step.id)).toEqual([
      'welcome',
      'entry',
      'draft',
      'proposal',
      'confirm',
      'arrival',
      'clock',
      'revisit',
      'closing',
    ])
  })

  it('advances on a signal for every step that represents progress the user must make', () => {
    // A dwell step where a signal belongs would let the caption run ahead of what the user has
    // actually done — the one thing the engine's two advance kinds exist to keep apart.
    const advances = new Map(
      ONBOARDING_SCRIPT.steps.map((step) => [
        step.id,
        step.advance.on === 'signal' ? step.advance.signal : 'dwell',
      ]),
    )
    expect(advances.get('entry')).toBe('writing-flow-opened')
    expect(advances.get('draft')).toBe('split-succeeded')
    expect(advances.get('confirm')).toBe('launch-succeeded')
    expect([...advances.values()].filter((advance) => advance !== 'dwell')).toHaveLength(3)
  })

  it('holds a signal step forever rather than owning a fallback', () => {
    // A failed split returns the shipped machine to `writing` and reports nothing, so step 3 simply
    // keeps its caption. There is no second way out of it: no dwell timer, no timeout, no retry.
    const draft = ONBOARDING_SCRIPT.steps[2]
    expect(draft.advance).toEqual({ on: 'signal', signal: 'split-succeeded' })
  })

  it('points at nothing on the steps that only narrate', () => {
    const anchored = new Map(ONBOARDING_SCRIPT.steps.map((step) => [step.id, step.anchor]))
    expect(anchored.get('welcome')).toBeUndefined()
    expect(anchored.get('arrival')).toBeUndefined()
    // The deliberate stopping point: recall is NAMED here and never performed, so there is nothing to
    // highlight — a ring around a paid control is an invitation to spend on the first minute.
    expect(anchored.get('revisit')).toBeUndefined()
    expect(anchored.get('closing')).toBeUndefined()
    expect(anchored.get('entry')).toBe('universe-write-entry')
    expect(anchored.get('draft')).toBe('writing-draft')
    expect(anchored.get('proposal')).toBe('writing-proposal')
    expect(anchored.get('confirm')).toBe('writing-confirm')
    expect(anchored.get('clock')).toBe('universe-clock')
  })

  it('says every line without a domain value in it, in both catalogues', () => {
    // What makes one script true for an empty first universe AND for a replay over a full one: a
    // caption that interpolated a memory's name, a memory count or a stardust amount would be a lie in one
    // of the two. A parameterized message called with no inputs renders `undefined`, which is what this
    // catches — along with an empty or missing translation.
    for (const locale of supportedLocales) {
      setActiveLocale(locale)
      for (const step of ONBOARDING_SCRIPT.steps) {
        const line = step.caption()
        expect(line.length, `${step.id} in ${locale}`).toBeGreaterThan(0)
        expect(line, `${step.id} in ${locale}`).not.toMatch(/undefined|[{}]/)
      }
    }
  })
})

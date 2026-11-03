import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import {
  advanceDecorationTour,
  decorationTourMachine,
  differentDecorationExample,
} from './decoration-tour.ts'

describe('guided decoration', () => {
  it('keeps the sky visible until preview completion, then requires a changed body', () => {
    const actor = createActor(decorationTourMachine).start()
    const change = (surface: 'background' | 'bodyShape', before: string, after: string) =>
      actor.send({ type: 'CHANGE', surface, before, after })
    actor.send({ type: 'PREVIEW_DONE' })
    change('background', 'grainient', 'grainient')
    change('bodyShape', 'facet', 'orb')
    expect(actor.getSnapshot().value).toBe('sky')
    change('background', 'grainient', 'soft-aurora')
    expect(actor.getSnapshot().value).toBe('sky-preview')
    change('bodyShape', 'facet', 'orb')
    expect(actor.getSnapshot().value).toBe('sky-preview')
    actor.send({ type: 'PREVIEW_DONE' })
    change('bodyShape', 'facet', 'facet')
    expect(actor.getSnapshot().value).toBe('shape')
    change('bodyShape', 'facet', 'orb')
    expect(actor.getSnapshot().value).toBe('finish')
    actor.send({ type: 'PREVIEW_DONE' })
    expect(actor.getSnapshot().value).toBe('finish')
    actor.stop()
  })
  it('waits for a real sky change and then a real body change before returning', () => {
    expect(advanceDecorationTour('sky', 'background', 'grainient', 'grainient')).toBe('sky')
    expect(advanceDecorationTour('sky', 'bodyShape', 'facet', 'orb')).toBe('sky')
    expect(advanceDecorationTour('sky', 'background', 'grainient', 'soft-aurora')).toBe(
      'sky-preview',
    )
    expect(advanceDecorationTour('sky-preview', 'bodyShape', 'facet', 'orb')).toBe('sky-preview')
    expect(advanceDecorationTour('shape', 'summaryShape', 'orb', 'prism')).toBe('shape')
    expect(advanceDecorationTour('shape', 'bodyShape', 'facet', 'facet')).toBe('shape')
    expect(advanceDecorationTour('shape', 'bodyShape', 'facet', 'orb')).toBe('finish')
    expect(advanceDecorationTour('finish', 'background', 'soft-aurora', 'grainient')).toBe('finish')
  })
  it('never points to the already displayed example, even when defaults change', () => {
    expect(
      differentDecorationExample(
        ['grainient', 'soft-aurora', 'grainstorm'],
        'grainient',
        'soft-aurora',
      ),
    ).toBe('soft-aurora')
    expect(
      differentDecorationExample(['grainient', 'soft-aurora'], 'soft-aurora', 'soft-aurora'),
    ).toBe('grainient')
    expect(differentDecorationExample(['orb', 'facet', 'prism'], 'orb', 'orb')).toBe('facet')
    expect(differentDecorationExample(['orb'], 'orb', 'orb')).toBeUndefined()
  })
})

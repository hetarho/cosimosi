import { describe, expect, it } from 'vitest'

import { LANDING_THEORY_CARDS } from '../config/theory-cards.ts'
import { LANDING_SECTIONS, type LandingSectionId } from './sections.ts'

describe('the landing section order', () => {
  it('is the prescribed five, in order', () => {
    expect(LANDING_SECTIONS).toEqual(['hero', 'walkthrough', 'theory', 'blog', 'closing-cta'])
  })

  it('carries none of the retired sections', () => {
    // playground, feature-tour and mirror were absorbed into the walkthrough (change 09), and the
    // standalone demo invitation now closes the walkthrough screen instead of holding one of its own.
    // A reappearing id would mean a second render path for something another section already owns.
    for (const retired of ['playground', 'feature-tour', 'mirror', 'demo-cta-top']) {
      expect(LANDING_SECTIONS).not.toContain(retired)
    }
  })

  it('walks the argument before explaining it, and asks last', () => {
    // The order is an argument, not a layout: show the whole arc (the [M5] mirror is its guarded
    // final step) with the offer to steer it at the end of that screen, then explain where the ideas
    // come from — and only then ask.
    const at = (id: LandingSectionId) => LANDING_SECTIONS.indexOf(id)
    expect(at('walkthrough')).toBe(at('hero') + 1)
    expect(at('walkthrough')).toBeLessThan(at('theory'))
    expect(at('closing-cta')).toBe(LANDING_SECTIONS.length - 1)
  })

  it('holds each section exactly once', () => {
    expect(new Set(LANDING_SECTIONS).size).toBe(LANDING_SECTIONS.length)
  })
})

describe('the authored content', () => {
  it('names the five research strands the blog anchors, and only those', () => {
    // The blog owns these five strings as a closed enum and emits them as group-heading ids. They are
    // duplicated across a build boundary, so this is the landing's half of the agreement — an unknown
    // pillar fails the blog's own build from the other side.
    expect(LANDING_THEORY_CARDS.map((card) => card.id)).toEqual([
      'engram',
      'spatial-representation',
      'synapse-time',
      'reconstructive-recall',
      'forgetting-accessibility',
    ])
    expect(LANDING_THEORY_CARDS.map((card) => card.blogAnchor)).toEqual([
      '/blog/#engram',
      '/blog/#spatial-representation',
      '/blog/#synapse-time',
      '/blog/#reconstructive-recall',
      '/blog/#forgetting-accessibility',
    ])
  })

  it('links to the blog by absolute path, never a client route', () => {
    // `/blog/` is Worker-served static HTML outside this router; a client navigation lands in the SPA
    // fallback instead of the post.
    for (const card of LANDING_THEORY_CARDS) {
      expect(card.blogAnchor.startsWith('/blog/#')).toBe(true)
    }
  })

  it('carries no citation field on a theory card', () => {
    // The structural half of "papers live on the blog": a DOI cannot be a rendered datum here, so an
    // over-claiming citation could only arrive as prose — which the copy-honesty test rejects.
    for (const card of LANDING_THEORY_CARDS) {
      expect(Object.keys(card).sort()).toEqual(['blogAnchor', 'body', 'id', 'title'])
    }
  })
})

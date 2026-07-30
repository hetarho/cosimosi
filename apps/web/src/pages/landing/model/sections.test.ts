import { describe, expect, it } from 'vitest'

import { LANDING_THEORY_CARDS, LANDING_TOUR_ITEMS } from '../config/theory-cards.ts'
import { LANDING_SECTIONS, type LandingSectionId } from './sections.ts'

describe('the landing section order', () => {
  it('is the prescribed seven, in order', () => {
    expect(LANDING_SECTIONS).toEqual([
      'hero',
      'demo-cta-top',
      'feature-tour',
      'mirror',
      'theory',
      'blog',
      'closing-cta',
    ])
  })

  it('states the definition before the theory, and asks last', () => {
    // The order is an argument, not a layout: show the thing, offer to move it, say what it does, correct
    // the one misreading that costs months, then explain where it came from — and only then ask.
    const at = (id: LandingSectionId) => LANDING_SECTIONS.indexOf(id)
    expect(at('mirror')).toBeLessThan(at('theory'))
    expect(at('demo-cta-top')).toBeLessThan(at('closing-cta'))
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

  it('walks the five behaviours in the order they happen to a user', () => {
    expect(LANDING_TOUR_ITEMS.map((item) => item.id)).toEqual([
      'write',
      'constellate',
      'fade',
      'revive',
      'color',
    ])
  })

  it('carries no citation field on a theory card', () => {
    // The structural half of "papers live on the blog": a DOI cannot be a rendered datum here, so an
    // over-claiming citation could only arrive as prose — which the copy-honesty test rejects.
    for (const card of LANDING_THEORY_CARDS) {
      expect(Object.keys(card).sort()).toEqual(['blogAnchor', 'body', 'id', 'title'])
    }
  })
})

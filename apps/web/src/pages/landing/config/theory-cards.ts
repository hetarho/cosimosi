import { m } from '../../../shared/i18n/index.ts'

/**
 * The five research strands the page summarizes, and the five behaviours it describes. Authored
 * content, fixed in count and order by the PRD — not tuning, and not something a values key would help.
 */

/**
 * A theory card carries an id, two message accessors and a blog anchor. It has **no citation field**,
 * and that absence is the point: a DOI cannot be a rendered datum here, so an over-claiming citation
 * could only arrive as prose — which the copy-honesty test rejects. The landing carries the summary a
 * non-specialist reads; papers live on the blog, one tier down.
 */
export interface LandingTheoryCard {
  readonly id: LandingTheoryId
  readonly title: () => string
  readonly body: () => string
  /**
   * An absolute path, followed by a plain anchor rather than a router link: `/blog/` is static HTML the
   * Worker serves, so a client navigation would land in the SPA fallback instead.
   */
  readonly blogAnchor: string
}

/**
 * The same five strings the blog owns as its closed `pillar` enum, which it emits as group-heading ids.
 * They are duplicated rather than imported because the blog is a separate build with no shared package;
 * a unit test pins this tuple, and an unknown pillar fails the blog's own build from the other side.
 */
export type LandingTheoryId =
  | 'engram'
  | 'spatial-representation'
  | 'synapse-time'
  | 'reconstructive-recall'
  | 'forgetting-accessibility'

export const LANDING_THEORY_CARDS = [
  {
    id: 'engram',
    title: m.landing_theory_engram_title,
    body: m.landing_theory_engram_body,
    blogAnchor: '/blog/#engram',
  },
  {
    id: 'spatial-representation',
    title: m.landing_theory_spatial_title,
    body: m.landing_theory_spatial_body,
    blogAnchor: '/blog/#spatial-representation',
  },
  {
    id: 'synapse-time',
    title: m.landing_theory_synapse_title,
    body: m.landing_theory_synapse_body,
    blogAnchor: '/blog/#synapse-time',
  },
  {
    id: 'reconstructive-recall',
    title: m.landing_theory_recall_title,
    body: m.landing_theory_recall_body,
    blogAnchor: '/blog/#reconstructive-recall',
  },
  {
    id: 'forgetting-accessibility',
    title: m.landing_theory_forgetting_title,
    body: m.landing_theory_forgetting_body,
    blogAnchor: '/blog/#forgetting-accessibility',
  },
] as const satisfies readonly [
  LandingTheoryCard,
  LandingTheoryCard,
  LandingTheoryCard,
  LandingTheoryCard,
  LandingTheoryCard,
]

export interface LandingTourItem {
  readonly id: LandingTourId
  readonly title: () => string
  readonly body: () => string
}

export type LandingTourId = 'write' | 'constellate' | 'fade' | 'revive' | 'color'

/**
 * Written from the reader's side — what happens to them, in the order it happens. Each item is a static
 * treatment: five live canvases on a page a stranger opens on mobile data is a battery decision, and
 * anyone who wants to watch it move is one click from the demo.
 */
export const LANDING_TOUR_ITEMS = [
  { id: 'write', title: m.landing_tour_write_title, body: m.landing_tour_write_body },
  {
    id: 'constellate',
    title: m.landing_tour_constellate_title,
    body: m.landing_tour_constellate_body,
  },
  { id: 'fade', title: m.landing_tour_fade_title, body: m.landing_tour_fade_body },
  { id: 'revive', title: m.landing_tour_revive_title, body: m.landing_tour_revive_body },
  { id: 'color', title: m.landing_tour_color_title, body: m.landing_tour_color_body },
] as const satisfies readonly [
  LandingTourItem,
  LandingTourItem,
  LandingTourItem,
  LandingTourItem,
  LandingTourItem,
]

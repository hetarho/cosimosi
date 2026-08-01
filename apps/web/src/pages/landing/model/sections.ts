/**
 * The landing page's information architecture, as a type rather than a layout convention.
 *
 * The order is prescribed: the empty sky, a sentence the visitor raises and recalls themselves, an
 * invitation to see the real thing move, what the product does in the user's own words, the one
 * definition a new user must not get wrong, where the ideas come from, the way to read further, and
 * only then the ask. The `satisfies` clause restates it, so dropping `'mirror'`, putting the theory
 * cards ahead of the definition, or adding a ninth section without placing it here is a `tsc`
 * failure rather than something a reviewer has to notice.
 *
 * `'playground'` sits directly under the hero because it is the page's argument in miniature: before
 * any copy explains fading or recall, the visitor has already watched their own sentence do both.
 *
 * That matters most for `'mirror'`. A visitor who leaves believing the sky averages their feelings will
 * read their own universe wrong for months, so the definition is a required section, not a nice-to-have
 * paragraph that a redesign can quietly drop.
 */
export const LANDING_SECTIONS = [
  'hero',
  'playground',
  'demo-cta-top',
  'feature-tour',
  'mirror',
  'theory',
  'blog',
  'closing-cta',
] as const satisfies readonly [
  'hero',
  'playground',
  'demo-cta-top',
  'feature-tour',
  'mirror',
  'theory',
  'blog',
  'closing-cta',
]

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]

/** What every section may reach: the two destinations, and nothing else. */
export interface LandingSectionProps {
  readonly onTryDemo: () => void
  readonly onSignUp: () => void
}

/**
 * The landing page's information architecture, as a type rather than a layout convention.
 *
 * The order is prescribed: the empty sky, the product's whole arc walked on one canvas, an
 * invitation to steer the real thing, where the ideas come from, the way to read further, and only
 * then the ask. The `satisfies` clause restates it, so dropping `'walkthrough'`, putting the theory
 * cards ahead of it, or adding a seventh section without placing it here is a `tsc` failure rather
 * than something a reviewer has to notice.
 *
 * `'walkthrough'` sits directly under the hero because it is the page's argument in full: before
 * any copy explains splitting, fading or the mirror, the visitor has already watched all of them
 * happen to one diary. The [M5] definition — the one sentence a visitor must not leave without —
 * lives inside it as the guarded final step of `WALKTHROUGH_STEPS`, so the compile-time guarantee
 * the old `'mirror'` section carried moved one level down rather than weakening.
 */
export const LANDING_SECTIONS = [
  'hero',
  'walkthrough',
  'demo-cta-top',
  'theory',
  'blog',
  'closing-cta',
] as const satisfies readonly [
  'hero',
  'walkthrough',
  'demo-cta-top',
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

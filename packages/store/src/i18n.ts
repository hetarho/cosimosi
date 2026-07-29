import { m } from '@cosimosi/i18n'

import type { OrnamentID } from './ornament-names.ts'
import { ORNAMENT_NAMES } from './ornament-names.ts'

// The localized name of each ornament. The server sends an id and nothing else — no label, no blurb,
// no image — so the display name is the client's, and one map holds all of them rather than each
// surface inventing a string.
//
// A name and no more: choosing a row applies it to the real universe immediately, so the sky itself
// is the description. What a name has to do is be sayable — the shortfall line points at one.
export function ornamentName(ornamentId: string): string {
  const name = ORNAMENT_NAMES[ornamentId as OrnamentID]
  // An id the catalog serves but this map has not caught up with reads as its bare id rather than as
  // an empty row: a fixture test pins the pair, so this is the shape of a mistake, not a state.
  return name ? name() : ornamentId
}

export { ORNAMENT_NAMES } from './ornament-names.ts'

/** Every kind's group heading, in the order the panel lists them. */
export const ORNAMENT_GROUP_TITLES = {
  BACKGROUND: m.store_group_background_title,
  STAR_SHADER: m.store_group_star_shader_title,
} as const

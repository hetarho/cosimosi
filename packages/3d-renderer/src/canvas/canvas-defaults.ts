import { VALUES } from '@cosimosi/config'

import { UNIVERSE_SKINS } from '../assets/skins/presets.ts'
import { resolveActiveSkin } from '../skin-context.ts'

/**
 * The camera/quality fallbacks the two canvas hosts share.
 *
 * They are DERIVED, never typed out: a literal default here is a second copy of a number the app
 * already owns, and the copy is what goes stale — a host keeps its own pixel ceiling the day
 * `max_pixel_ratio` moves, and its own framing the day the skin is re-lit, with nothing on screen to
 * say so. Every real mount passes both props explicitly; these only cover mounts with no opinion.
 */
export const DEFAULT_CANVAS_DPR: [number, number] = [1, VALUES.rendering.maxPixelRatio]

export const DEFAULT_CANVAS_FOV =
  UNIVERSE_SKINS[resolveActiveSkin(VALUES.rendering.activeSkin)].camera.fov

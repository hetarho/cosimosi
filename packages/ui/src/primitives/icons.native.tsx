import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen'
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix'
import { InfoIcon } from 'phosphor-react-native/src/icons/Info'
import { PaletteIcon } from 'phosphor-react-native/src/icons/Palette'
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle'

import { color } from '../native-styles.ts'
import type { IconOwnProps } from './types.ts'

export type IconProps = IconOwnProps & { color?: string }

/**
 * The RN fork of the icon set — same product meanings, same sizes, glyphs drawn through
 * `react-native-svg`. Two things genuinely differ from the web sibling:
 *
 * - **Ink is explicit.** RN has no `currentColor`, so each icon takes a colour prop defaulting to
 *   the neutral text token — the ink of the default `IconButton` (`variant="text" color="neutral"`).
 *   A call site inside a coloured control passes its own role colour.
 * - **Imports are per-glyph.** Metro does not tree-shake, so the package root (≈9k icons) would
 *   land whole in the bundle; the `./src/icons/*` subpath is what the library ships for this.
 */
export const ICON_SIZE = 16

/** SMALL Twinkle — the daily recall allowance. The lighter of the two densities. */
export function TwinkleSmallIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <SparkleIcon size={size} color={ink} weight="regular" />
}

/** GENERAL Twinkle — the permanent reserve. The same glyph, filled: more of the same substance. */
export function TwinkleGeneralIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <SparkleIcon size={size} color={ink} weight="fill" />
}

/** The signed-in account home. */
export function SettingsIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <GearSixIcon size={size} color={ink} />
}

/** 우주 꾸미기 — the ornament panel. */
export function DecorateIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <PaletteIcon size={size} color={ink} />
}

/** 일기장 — the diary archive. */
export function DiaryIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <BookOpenIcon size={size} color={ink} />
}

/** An explanation waiting behind a control — a guide or a disclosure, never a failure. */
export function NoticeIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <InfoIcon size={size} color={ink} />
}

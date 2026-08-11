import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise'
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen'
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix'
import { InfoIcon } from 'phosphor-react-native/src/icons/Info'
import { PaletteIcon } from 'phosphor-react-native/src/icons/Palette'
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle'
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash'

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

/** 조건 초기화 — the way back out of a narrowed view. It restores nothing and destroys nothing. */
export function ResetIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <ArrowCounterClockwiseIcon size={size} color={ink} />
}

/** 지우기 — the destructive act on the record this control sits beside. */
export function DeleteIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <TrashIcon size={size} color={ink} />
}

/**
 * 이 별로 할 수 있는 일 — the star's own set of actions, gathered behind one control.
 *
 * It shares the gear with `SettingsIcon` and is a separate meaning all the same: a slice asks for
 * the star's actions, not for a gear, so rebinding either one later is a change in this file.
 */
export function StarActionsIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <GearSixIcon size={size} color={ink} />
}

import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise'
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft'
import { ArrowsOutCardinalIcon } from 'phosphor-react-native/src/icons/ArrowsOutCardinal'
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen'
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown'
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix'
import { InfoIcon } from 'phosphor-react-native/src/icons/Info'
import { PaletteIcon } from 'phosphor-react-native/src/icons/Palette'
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus'
import { PushPinIcon } from 'phosphor-react-native/src/icons/PushPin'
import { SortAscendingIcon } from 'phosphor-react-native/src/icons/SortAscending'
import { SortDescendingIcon } from 'phosphor-react-native/src/icons/SortDescending'
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

/**
 * The larger cut, for a glyph standing ALONE as a control — an icon-only button whose whole meaning
 * is the drawing, with no label beside it to share the reading. It is the same button box; only the
 * ink inside grows.
 */
export const ICON_SIZE_LG = 20

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

/** 고정 모드 — the view held flat and centred, with only so much give in it. */
export function PinnedViewIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <PushPinIcon size={size} color={ink} weight="fill" />
}

/** 자유 모드 — the view free to turn in any direction. */
export function FreeViewIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <ArrowsOutCardinalIcon size={size} color={ink} />
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

/** 최신순 — the newest of a list at the top. The glyph beside the order a control is showing now. */
export function NewestFirstIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <SortDescendingIcon size={size} color={ink} />
}

/** 오래된순 — the oldest of a list at the top. */
export function OldestFirstIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <SortAscendingIcon size={size} color={ink} />
}

/**
 * 돌아가기 — the way back to the place this one was opened from.
 *
 * It points LEFT rather than up or out, because every back navigation in the product returns along
 * the way it came; a slice asks for the way back, never for an arrow.
 */
export function BackIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <ArrowLeftIcon size={size} color={ink} />
}

/** A list of choices waiting under a control — the mark that says a press opens one. */
export function DropdownIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <CaretDownIcon size={size} color={ink} />
}

/** 더하기 — this control adds one more of the thing beside it. */
export function AddIcon({ size = ICON_SIZE, color: ink = color.text }: IconProps) {
  return <PlusIcon size={size} color={ink} />
}

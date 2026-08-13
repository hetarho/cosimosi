import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowsOutCardinalIcon,
  BookOpenIcon,
  CaretDownIcon,
  GearSixIcon,
  InfoIcon,
  PaletteIcon,
  PlusIcon,
  PushPinIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SparkleIcon,
  TrashIcon,
} from '@phosphor-icons/react'

import type { IconOwnProps } from './types.ts'

export type IconProps = IconOwnProps & { className?: string }

/**
 * The product's icon set — Phosphor glyphs bound to product meanings, and the only place a glyph
 * name appears. A slice asks for the 일기장 icon, not for a book: rebinding a meaning to a different
 * glyph is then a change here, and the app layers never learn which family draws it.
 *
 * Every icon renders at `ICON_SIZE` in `currentColor` (Phosphor's default) so it takes the ink of
 * the control around it, and carries `aria-hidden` — an icon is never the accessible name, which is
 * why `IconButton` requires a `label` (design-language §8).
 */
export const ICON_SIZE = 16

/**
 * The larger cut, for a glyph standing ALONE as a control — an icon-only button whose whole meaning
 * is the drawing, with no label beside it to share the reading. It is the same button box (`size`
 * on `IconButton` owns that); only the ink inside grows, because at 16 a lone glyph over a live sky
 * reads as a mark rather than as a thing to press.
 */
export const ICON_SIZE_LG = 20

/** SMALL Twinkle — the daily recall allowance. The lighter of the two densities. */
export function TwinkleSmallIcon({ size = ICON_SIZE, className }: IconProps) {
  return <SparkleIcon aria-hidden size={size} weight="regular" className={className} />
}

/** GENERAL Twinkle — the permanent reserve. The same glyph, filled: more of the same substance. */
export function TwinkleGeneralIcon({ size = ICON_SIZE, className }: IconProps) {
  return <SparkleIcon aria-hidden size={size} weight="fill" className={className} />
}

/** The signed-in account home. */
export function SettingsIcon({ size = ICON_SIZE, className }: IconProps) {
  return <GearSixIcon aria-hidden size={size} className={className} />
}

/** 우주 꾸미기 — the ornament panel. */
export function DecorateIcon({ size = ICON_SIZE, className }: IconProps) {
  return <PaletteIcon aria-hidden size={size} className={className} />
}

/** 일기장 — the diary archive. */
export function DiaryIcon({ size = ICON_SIZE, className }: IconProps) {
  return <BookOpenIcon aria-hidden size={size} className={className} />
}

/** An explanation waiting behind a control — a guide or a disclosure, never a failure. */
export function NoticeIcon({ size = ICON_SIZE, className }: IconProps) {
  return <InfoIcon aria-hidden size={size} className={className} />
}

/** 조건 초기화 — the way back out of a narrowed view. It restores nothing and destroys nothing. */
export function ResetIcon({ size = ICON_SIZE, className }: IconProps) {
  return <ArrowCounterClockwiseIcon aria-hidden size={size} className={className} />
}

/** 지우기 — the destructive act on the record this control sits beside. */
export function DeleteIcon({ size = ICON_SIZE, className }: IconProps) {
  return <TrashIcon aria-hidden size={size} className={className} />
}

/** 고정 모드 — the view held flat and centred, with only so much give in it. */
export function PinnedViewIcon({ size = ICON_SIZE, className }: IconProps) {
  return <PushPinIcon aria-hidden size={size} weight="fill" className={className} />
}

/** 자유 모드 — the view free to turn in any direction. */
export function FreeViewIcon({ size = ICON_SIZE, className }: IconProps) {
  return <ArrowsOutCardinalIcon aria-hidden size={size} className={className} />
}

/**
 * 이 별로 할 수 있는 일 — the star's own set of actions, gathered behind one control.
 *
 * It shares the gear with `SettingsIcon` and is a separate meaning all the same: a slice asks for
 * the star's actions, not for a gear, so rebinding either one later is a change in this file.
 */
export function StarActionsIcon({ size = ICON_SIZE, className }: IconProps) {
  return <GearSixIcon aria-hidden size={size} className={className} />
}

/** 최신순 — the newest of a list at the top. The glyph beside the order a control is showing now. */
export function NewestFirstIcon({ size = ICON_SIZE, className }: IconProps) {
  return <SortDescendingIcon aria-hidden size={size} className={className} />
}

/** 오래된순 — the oldest of a list at the top. */
export function OldestFirstIcon({ size = ICON_SIZE, className }: IconProps) {
  return <SortAscendingIcon aria-hidden size={size} className={className} />
}

/**
 * 돌아가기 — the way back to the place this one was opened from.
 *
 * It points LEFT rather than up or out, because every back navigation in the product returns along
 * the way it came; a slice asks for the way back, never for an arrow.
 */
export function BackIcon({ size = ICON_SIZE, className }: IconProps) {
  return <ArrowLeftIcon aria-hidden size={size} className={className} />
}

/** A list of choices waiting under a control — the mark that says a press opens one. */
export function DropdownIcon({ size = ICON_SIZE, className }: IconProps) {
  return <CaretDownIcon aria-hidden size={size} className={className} />
}

/** 더하기 — this control adds one more of the thing beside it. */
export function AddIcon({ size = ICON_SIZE, className }: IconProps) {
  return <PlusIcon aria-hidden size={size} className={className} />
}

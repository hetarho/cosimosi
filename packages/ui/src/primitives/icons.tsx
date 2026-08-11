import {
  ArrowCounterClockwiseIcon,
  BookOpenIcon,
  GearSixIcon,
  InfoIcon,
  PaletteIcon,
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

/**
 * 이 별로 할 수 있는 일 — the star's own set of actions, gathered behind one control.
 *
 * It shares the gear with `SettingsIcon` and is a separate meaning all the same: a slice asks for
 * the star's actions, not for a gear, so rebinding either one later is a change in this file.
 */
export function StarActionsIcon({ size = ICON_SIZE, className }: IconProps) {
  return <GearSixIcon aria-hidden size={size} className={className} />
}

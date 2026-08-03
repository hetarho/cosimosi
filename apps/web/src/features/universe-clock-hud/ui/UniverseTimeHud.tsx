import { useUniverseClockStore } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

export interface UniverseTimeHudProps {
  /** While the acceleration plays, the widget hands in the sweeping date; the store value resumes after. */
  overrideTime?: string | null
}

// The persistent "우리 우주의 시간" HUD ([T6]): the last diary date, or the empty-universe line while
// the clock is unborn. A label and a value only — no control sits here, so nothing can rewind, place,
// or edit meaning from the time surface ([I10][I11]).
//
// Bare type, not a chip. A surface behind it made the one reading that belongs to the PLACE look like
// another control in the chrome; the sky is what it is written on. Legibility over a bright nebula
// comes from a shadow on the glyphs instead of a panel under them.
export function UniverseTimeHud({ overrideTime = null }: UniverseTimeHudProps) {
  const currentUniverseTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const shown = overrideTime ?? currentUniverseTime
  return (
    <div className="pointer-events-none flex items-baseline gap-2 drop-shadow-md">
      <span className="text-xs text-text-muted">{m.universe_time_hud_label()}</span>
      {shown ? (
        <span className="text-sm tabular-nums text-text">{shown}</span>
      ) : (
        <span className="text-sm text-text-subtle">{m.universe_time_hud_empty()}</span>
      )}
    </div>
  )
}

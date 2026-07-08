import { useUniverseClockStore } from '../../../entities/universe-clock/index.ts'
import { m } from '../../../shared/i18n/index.ts'

export interface UniverseTimeHudProps {
  /** While the acceleration plays, the widget hands in the sweeping date; the store value resumes after. */
  overrideTime?: string | null
}

// The persistent "우주의 시간" HUD ([T6]): the last diary date, or the empty-universe line while the
// clock is unborn. A label and a value only — no control sits here, so nothing can rewind, place,
// or edit meaning from the time surface ([I10][I11]).
export function UniverseTimeHud({ overrideTime = null }: UniverseTimeHudProps) {
  const currentUniverseTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const shown = overrideTime ?? currentUniverseTime
  return (
    <div className="glass-subtle pointer-events-none flex items-baseline gap-2 rounded-md px-3 py-1.5">
      <span className="text-xs text-text-muted">{m.universe_time_hud_label()}</span>
      {shown ? (
        <span className="text-sm tabular-nums text-text">{shown}</span>
      ) : (
        <span className="text-sm text-text-subtle">{m.universe_time_hud_empty()}</span>
      )}
    </div>
  )
}

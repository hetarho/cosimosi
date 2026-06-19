import { MOODS, type Mood, moodLabel, moodRgb } from '@/shared/config'

export interface MoodChipsProps {
  /** Currently-selected moods (empty = no emotion filter / all). */
  selected: readonly Mood[]
  /** Toggle one mood in/out of the selection. */
  onToggle: (mood: Mood) => void
  /** Restrict the offered chips (e.g. only moods present in the data). Omit = all 13. */
  available?: readonly Mood[]
}

/** A linear-RGB tuple (0..1) → an `rgb()` string for a small color dot. */
function rgbCss([r, g, b]: readonly [number, number, number]): string {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
}

/**
 * Multi-select emotion-filter chips (change 09) — the shared 감정 facet control for the
 * telescope diary/star tabs and the diary page. Each chip is a toggle with the mood's color
 * dot + Korean label; selected chips read brighter. Pure presentational (no data/query) so
 * every filtering surface wears the same control. aria-pressed reflects selection.
 */
export function MoodChips({ selected, onToggle, available = MOODS }: MoodChipsProps) {
  const sel = new Set(selected)
  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((mood) => {
        const on = sel.has(mood)
        return (
          <button
            key={mood}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(mood)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
              on
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/10'
            }`}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: rgbCss(moodRgb(mood)) }}
              aria-hidden
            />
            {moodLabel(mood)}
          </button>
        )
      })}
    </div>
  )
}

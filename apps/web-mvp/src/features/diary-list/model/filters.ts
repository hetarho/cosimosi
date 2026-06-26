// Pure diary-list filtering (change 09) — the search + emotion + date-range logic for the
// telescope 일기 탭 and the standalone diary page, kept OUT of the components so both reuse
// it and it unit-tests without React. No three/React/DOM import (헌법4 — RN reusable).
import { type Mood, moodLabel } from '@/shared/config'

/** One diary as the filter sees it — the caller normalizes RecordSummary (proto) into this
 *  (proto Mood enum → domain mood string via moodFromProto). entryDate is "YYYY-MM-DD". */
export interface DiaryFilterEntry {
  recordId: string
  entryDate: string
  bodyExcerpt: string
  moods: readonly Mood[]
}

/** The active filter. moods empty = all emotions; from/to ("YYYY-MM-DD", inclusive) absent
 *  = unbounded. "YYYY-MM-DD" strings compare lexicographically = chronologically. */
export interface DiaryFilterCriteria {
  query: string
  moods: readonly Mood[]
  from?: string
  to?: string
}

/** Filters diaries by free-text (date · body excerpt · emotion label), an emotion facet
 *  (ANY selected mood present in the diary), and an inclusive entry-date range. Generic over
 *  the entry type so callers can carry display-only fields (e.g. starCount) through. Pure. */
export function filterDiaries<T extends DiaryFilterEntry>(
  entries: readonly T[],
  { query, moods, from, to }: DiaryFilterCriteria,
): T[] {
  const q = query.trim().toLowerCase()
  const moodSet = moods.length > 0 ? new Set(moods) : null
  return entries.filter((e) => {
    if (from && e.entryDate < from) return false
    if (to && e.entryDate > to) return false
    if (moodSet && !e.moods.some((m) => moodSet.has(m))) return false
    if (q) {
      const hay =
        e.bodyExcerpt.toLowerCase() +
        ' ' +
        e.entryDate +
        ' ' +
        e.moods.map((m) => moodLabel(m).toLowerCase() + ' ' + m).join(' ')
      if (!hay.includes(q)) return false
    }
    return true
  })
}

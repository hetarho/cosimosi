// Pure star-explorer filtering (change 09) — the search + emotion + date + dormancy logic
// for the telescope 별 탭, which shows AWAKE and DORMANT stars in ONE list (no separate
// dormant entry point). Kept out of the component so it unit-tests without React. The
// time-dependent bits (dormant / brightness, which need `now` = virtual clock) are computed
// by the caller and passed in as plain fields — this stays pure & deterministic (no clock
// read here). No three/React/DOM import (헌법4 — RN reusable).
import { type Mood, moodLabel } from '@/shared/config'

/** One star as the filter sees it. The caller builds this by merging useMemoryStore.stars
 *  with the records map (entryDate) and computing dormant/brightness from the virtual now. */
export interface StarFilterEntry {
  memoryId: string
  mood: Mood
  /** "YYYY-MM-DD" of the original diary (from the records map); undefined when unknown. */
  entryDate?: string
  /** epoch ms — last recall (for ordering by the caller; not filtered here). */
  lastRecalledAt: number
  /** caller-computed (isDormant with the virtual clock). */
  dormant: boolean
}

/** all = awake + dormant; dormant = only dormant; awake = only awake. */
export type DormancyFilter = 'all' | 'dormant' | 'awake'

export interface StarFilterCriteria {
  query: string
  moods: readonly Mood[]
  from?: string
  to?: string
  dormancy: DormancyFilter
}

/** Filters stars by free-text (emotion label · id), emotion facet (ANY selected mood),
 *  inclusive entry-date range, and dormancy state. Generic over the entry type so callers can
 *  carry display fields (brightness, etc.) through. Pure (caller injects dormant/dates). */
export function filterStars<T extends StarFilterEntry>(
  entries: readonly T[],
  { query, moods, from, to, dormancy }: StarFilterCriteria,
): T[] {
  const q = query.trim().toLowerCase()
  const moodSet = moods.length > 0 ? new Set(moods) : null
  return entries.filter((e) => {
    if (dormancy === 'dormant' && !e.dormant) return false
    if (dormancy === 'awake' && e.dormant) return false
    if (moodSet && !moodSet.has(e.mood)) return false
    if ((from || to) && !e.entryDate) return false // a date filter excludes date-less stars
    if (from && e.entryDate && e.entryDate < from) return false
    if (to && e.entryDate && e.entryDate > to) return false
    if (q) {
      const hay = `${moodLabel(e.mood).toLowerCase()} ${e.mood} ${e.memoryId.toLowerCase()}`
      if (!hay.includes(q)) return false
    }
    return true
  })
}

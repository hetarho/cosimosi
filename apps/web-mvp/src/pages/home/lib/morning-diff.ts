// Morning diff (spec 27, acceptance 6.1): the nightly consolidation runs once a night,
// so the first universe open of a new local day IS "공고화 이후 처음" — show the note once.
// localStorage day-stamp gates it to one show per day (no server signal needed; star
// coordinates/consolidation state never ride proto — 헌법3). claim returns true exactly
// once per local day and persists immediately, so a re-render / refetch can't re-fire it.
const MORNING_DIFF_KEY = 'cosimosi:morning-diff:lastShown'

export function claimMorningDiffForToday(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local tz
    if (window.localStorage.getItem(MORNING_DIFF_KEY) === today) return false
    window.localStorage.setItem(MORNING_DIFF_KEY, today)
    return true
  } catch {
    return false // private mode / disabled storage — just skip the note
  }
}

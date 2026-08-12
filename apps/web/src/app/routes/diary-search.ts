import { DiarySort, type GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS } from '@cosimosi/emotion'
import {
  DIARY_MEMORY_COUNT_ALL,
  diaryMemoryCountOption,
  diaryMemoryCountOptions,
  diaryMemoryCountRange,
} from '@cosimosi/memory'
import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'

/** The `/diary` address bar's shape. Short keys, because a shared archive link is read by people. */
export interface DiarySearchParams {
  q?: string
  moods?: string[]
  from?: string
  to?: string
  sort?: 'newest' | 'oldest'
  /** Which live-memory-count choice is active, as the option key the control speaks ([D9]). One key
   *  rather than a min/max pair: the choices are a closed list, and a hand-typed `?memories=2` is then
   *  either a choice the archive offers or nothing at all. */
  memories?: string
  // View state, NOT archive conditions ([D12]): which shape of the archive is showing and which month the
  // calendar is on. They deliberately stay out of the three conditions mappers below — routing a view key
  // through them would make a view switch look like a conditions change and reset the archive.
  view?: 'calendar'
  month?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// The URL is user-editable, so every field is validated here and an unusable one is dropped rather
// than forwarded: a hand-typed `?sort=sideways` or `?moods=nonsense` leaves the archive in its default
// order instead of provoking a refusal the reader cannot act on.
export function parseDiarySearch(search: Record<string, unknown>): DiarySearchParams {
  // A keyword below the server's minimum is dropped rather than forwarded: the read would refuse it,
  // and nothing downstream ever normalises it away, so a hand-shortened link would show only an error.
  const typed = typeof search.q === 'string' ? search.q : undefined
  const q =
    typed && typed.trim().length >= VALUES.diaryReader.searchMinQueryLength ? typed : undefined
  const raw = Array.isArray(search.moods)
    ? search.moods
    : typeof search.moods === 'string'
      ? [search.moods]
      : []
  const moods = MOODS.filter((mood) => raw.includes(mood))
  const from =
    typeof search.from === 'string' && ISO_DATE.test(search.from) ? search.from : undefined
  const to = typeof search.to === 'string' && ISO_DATE.test(search.to) ? search.to : undefined
  const sort = search.sort === 'oldest' ? 'oldest' : undefined
  // `all` is the absent default, so only a real narrowing writes a key — and an option this build does
  // not offer is dropped rather than forwarded as a range the reader never chose.
  const offered = diaryMemoryCountOptions(VALUES.encode.maxMemories)
  const memories =
    typeof search.memories === 'string' &&
    search.memories !== DIARY_MEMORY_COUNT_ALL &&
    offered.includes(search.memories)
      ? search.memories
      : undefined
  // `list` is the absent default, so a bare `/diary` stays bare and mounting the calendar is the only
  // thing that writes a `view` key at all.
  const view = search.view === 'calendar' ? 'calendar' : undefined
  const month =
    typeof search.month === 'string' && ISO_MONTH.test(search.month) ? search.month : undefined
  return {
    q,
    moods: moods.length > 0 ? [...moods] : undefined,
    from,
    to,
    sort,
    memories,
    view,
    month,
  }
}

// The archive read speaks the generated request shape, so the app layer is the only place the two
// vocabularies meet — nothing below it holds a hand-written mirror of the conditions.
export function diaryQueryFromSearch(params: DiarySearchParams): GetDiariesInput {
  const range = diaryMemoryCountRange(
    params.memories ?? DIARY_MEMORY_COUNT_ALL,
    VALUES.encode.maxMemories,
  )
  return {
    query: params.q ?? '',
    moods: params.moods ?? [],
    from: params.from ?? '',
    to: params.to ?? '',
    sort: params.sort === 'oldest' ? DiarySort.OLDEST : DiarySort.NEWEST,
    minMemories: range.min,
    maxMemories: range.max,
  }
}

// Empty conditions become absent keys, so the default view's URL stays a bare `/diary`.
export function diarySearchFromQuery(query: GetDiariesInput): DiarySearchParams {
  const moods = query.moods ?? []
  const memories = diaryMemoryCountOption(
    { min: query.minMemories, max: query.maxMemories },
    VALUES.encode.maxMemories,
  )
  return {
    q: (query.query ?? '') !== '' ? query.query : undefined,
    moods: moods.length > 0 ? [...moods] : undefined,
    from: (query.from ?? '') !== '' ? query.from : undefined,
    to: (query.to ?? '') !== '' ? query.to : undefined,
    sort: query.sort === DiarySort.OLDEST ? 'oldest' : undefined,
    memories: memories === DIARY_MEMORY_COUNT_ALL ? undefined : memories,
  }
}

// Merges a conditions update onto the LIVE search rather than a captured snapshot — the router hands
// the previous search in, so two controls touched inside one navigation round trip both survive.
//
// `view`/`month` are carried across untouched: they are view state, and the conditions mappers above do
// not round-trip them, so without this a keystroke in the search field would drop the reader out of the
// calendar mid-typing.
export function searchWithUpdate(
  previous: DiarySearchParams,
  update: DiaryConditionsUpdate,
): DiarySearchParams {
  return {
    ...diarySearchFromQuery(update(diaryQueryFromSearch(previous))),
    view: previous.view,
    month: previous.month,
  }
}

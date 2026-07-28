import { DiarySort, type GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS } from '@cosimosi/emotion'
import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'

/** The `/diary` address bar's shape. Short keys, because a shared archive link is read by people. */
export interface DiarySearchParams {
  q?: string
  moods?: string[]
  from?: string
  to?: string
  sort?: 'newest' | 'oldest'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
  return { q, moods: moods.length > 0 ? [...moods] : undefined, from, to, sort }
}

// The archive read speaks the generated request shape, so the app layer is the only place the two
// vocabularies meet — nothing below it holds a hand-written mirror of the conditions.
export function diaryQueryFromSearch(params: DiarySearchParams): GetDiariesInput {
  return {
    query: params.q ?? '',
    moods: params.moods ?? [],
    from: params.from ?? '',
    to: params.to ?? '',
    sort: params.sort === 'oldest' ? DiarySort.OLDEST : DiarySort.NEWEST,
  }
}

// Empty conditions become absent keys, so the default view's URL stays a bare `/diary`.
export function diarySearchFromQuery(query: GetDiariesInput): DiarySearchParams {
  const moods = query.moods ?? []
  return {
    q: (query.query ?? '') !== '' ? query.query : undefined,
    moods: moods.length > 0 ? [...moods] : undefined,
    from: (query.from ?? '') !== '' ? query.from : undefined,
    to: (query.to ?? '') !== '' ? query.to : undefined,
    sort: query.sort === DiarySort.OLDEST ? 'oldest' : undefined,
  }
}

// Merges a conditions update onto the LIVE search rather than a captured snapshot — the router hands
// the previous search in, so two controls touched inside one navigation round trip both survive.
export function searchWithUpdate(
  previous: DiarySearchParams,
  update: DiaryConditionsUpdate,
): DiarySearchParams {
  return diarySearchFromQuery(update(diaryQueryFromSearch(previous)))
}

import { useEffect, useState } from 'react'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { isDateRangeUsable, isKeywordSearchable, shouldAdoptCommitted } from '@cosimosi/memory'

/**
 * Applied by the host against its own live conditions, never against a snapshot this hook captured.
 * The web host's conditions live in the URL and land a navigation later, so a plain object patch
 * would let two controls touched inside one round trip overwrite each other's pick.
 */
export type DiaryConditionsUpdate = (previous: GetDiariesInput) => GetDiariesInput

export interface DiaryConditions {
  /** What the keyword field shows right now — uncommitted, so a half-typed word is never a request. */
  keywordDraft: string
  setKeywordDraft: (next: string) => void
  /** The trimmed draft is below the server's minimum, so it is deliberately not being searched. */
  keywordTooShort: boolean
  fromDraft: string
  setFromDraft: (next: string) => void
  toDraft: string
  setToDraft: (next: string) => void
  /** A date draft is unusable (not ISO, or the range runs backwards), so it is not being searched. */
  dateRangeInvalid: boolean
  moods: readonly string[]
  toggleMood: (mood: string) => void
  hasConditions: boolean
  clear: () => void
}

// Holds a fast-changing draft still until the typing stops, so one phrase costs one read.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (Object.is(value, settled)) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, settled, delayMs])
  return settled
}

// features/search-diary model ([D8][D9]): the archive's conditions, held as drafts and committed only
// when they are usable. Free of platform primitives, so web and mobile share it verbatim rather than
// each re-deriving the debounce, the minimum-length rule and the range rule (ARCHITECTURE §3.5).
//
// Every commit is an UPDATE FUNCTION, which is what makes two controls touched in the same breath
// safe: the host merges onto its live conditions, so a mood chip cannot erase a keyword that is still
// on its way into the URL.
export function useDiaryConditions(
  value: GetDiariesInput,
  onChange: (update: DiaryConditionsUpdate) => void,
): DiaryConditions {
  const committedKeyword = value.query ?? ''
  const committedFrom = value.from ?? ''
  const committedTo = value.to ?? ''

  const [keywordDraft, setKeywordDraft] = useState(committedKeyword)
  const [fromDraft, setFromDraft] = useState(committedFrom)
  const [toDraft, setToDraft] = useState(committedTo)

  const settledKeyword = useDebouncedValue(keywordDraft, VALUES.diaryReader.searchDebounceMs)
  const settledFrom = useDebouncedValue(fromDraft, VALUES.diaryReader.searchDebounceMs)
  const settledTo = useDebouncedValue(toDraft, VALUES.diaryReader.searchDebounceMs)

  // Adopt a condition changed behind this hook — a Back navigation, a cleared filter — while leaving
  // a draft alone when the incoming value is merely the trimmed form of what is already typed. Without
  // that second test the commit would eat a trailing space mid-phrase, and on a composing IME it would
  // replace the syllable being assembled.
  const [seen, setSeen] = useState({
    keyword: committedKeyword,
    from: committedFrom,
    to: committedTo,
  })
  if (seen.keyword !== committedKeyword || seen.from !== committedFrom || seen.to !== committedTo) {
    setSeen({ keyword: committedKeyword, from: committedFrom, to: committedTo })
    if (seen.keyword !== committedKeyword && shouldAdoptCommitted(keywordDraft, committedKeyword)) {
      setKeywordDraft(committedKeyword)
    }
    if (seen.from !== committedFrom && shouldAdoptCommitted(fromDraft, committedFrom)) {
      setFromDraft(committedFrom)
    }
    if (seen.to !== committedTo && shouldAdoptCommitted(toDraft, committedTo)) {
      setToDraft(committedTo)
    }
  }

  const trimmedKeyword = settledKeyword.trim()
  const keywordTooShort = !isKeywordSearchable(
    settledKeyword,
    VALUES.diaryReader.searchMinQueryLength,
  )

  const nextFrom = settledFrom.trim()
  const nextTo = settledTo.trim()
  // A half-typed date and an inverted range are each refused by the read, so neither is committed —
  // the reader keeps the previous result set and a hint says why.
  const dateRangeInvalid = !isDateRangeUsable(nextFrom, nextTo)

  useEffect(() => {
    if (keywordTooShort) return
    if (trimmedKeyword === committedKeyword) return
    onChange((previous) => ({ ...previous, query: trimmedKeyword }))
  }, [trimmedKeyword, keywordTooShort, committedKeyword, onChange])

  useEffect(() => {
    if (dateRangeInvalid) return
    if (nextFrom === committedFrom && nextTo === committedTo) return
    onChange((previous) => ({ ...previous, from: nextFrom, to: nextTo }))
  }, [nextFrom, nextTo, dateRangeInvalid, committedFrom, committedTo, onChange])

  const moods = value.moods ?? []
  const hasConditions =
    committedKeyword !== '' || moods.length > 0 || committedFrom !== '' || committedTo !== ''

  return {
    keywordDraft,
    setKeywordDraft,
    keywordTooShort,
    fromDraft,
    setFromDraft,
    toDraft,
    setToDraft,
    dateRangeInvalid,
    moods,
    toggleMood: (mood) =>
      onChange((previous) => {
        const current = previous.moods ?? []
        return {
          ...previous,
          moods: current.includes(mood)
            ? current.filter((entry) => entry !== mood)
            : [...current, mood],
        }
      }),
    hasConditions,
    clear: () => {
      setKeywordDraft('')
      setFromDraft('')
      setToDraft('')
      onChange((previous) => ({ ...previous, query: '', moods: [], from: '', to: '' }))
    },
  }
}

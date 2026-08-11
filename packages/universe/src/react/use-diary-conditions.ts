import { useEffect, useState } from 'react'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { isKeywordSearchable, shouldAdoptCommitted } from '@cosimosi/memory'

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
// each re-deriving the debounce and the minimum-length rule (ARCHITECTURE §3.5).
//
// Every commit is an UPDATE FUNCTION, which is what makes two controls touched in the same breath
// safe: the host merges onto its live conditions, so a mood chip cannot erase a keyword that is still
// on its way into the URL.
export function useDiaryConditions(
  value: GetDiariesInput,
  onChange: (update: DiaryConditionsUpdate) => void,
): DiaryConditions {
  const committedKeyword = value.query ?? ''
  // The date range has no control of its own: it is written by a shared link and read back here so
  // a day-bounded archive still counts as filtered and still offers its way out.
  const committedFrom = value.from ?? ''
  const committedTo = value.to ?? ''

  const [keywordDraft, setKeywordDraft] = useState(committedKeyword)

  const settledKeyword = useDebouncedValue(keywordDraft, VALUES.diaryReader.searchDebounceMs)

  // Adopt a condition changed behind this hook — a Back navigation, a cleared filter — while leaving
  // a draft alone when the incoming value is merely the trimmed form of what is already typed. Without
  // that second test the commit would eat a trailing space mid-phrase, and on a composing IME it would
  // replace the syllable being assembled.
  const [seen, setSeen] = useState(committedKeyword)
  if (seen !== committedKeyword) {
    setSeen(committedKeyword)
    if (shouldAdoptCommitted(keywordDraft, committedKeyword)) setKeywordDraft(committedKeyword)
  }

  const trimmedKeyword = settledKeyword.trim()
  const keywordTooShort = !isKeywordSearchable(
    settledKeyword,
    VALUES.diaryReader.searchMinQueryLength,
  )

  useEffect(() => {
    if (keywordTooShort) return
    if (trimmedKeyword === committedKeyword) return
    onChange((previous) => ({ ...previous, query: trimmedKeyword }))
  }, [trimmedKeyword, keywordTooShort, committedKeyword, onChange])

  const moods = value.moods ?? []
  const hasConditions =
    committedKeyword !== '' || moods.length > 0 || committedFrom !== '' || committedTo !== ''

  return {
    keywordDraft,
    setKeywordDraft,
    keywordTooShort,
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
      onChange((previous) => ({ ...previous, query: '', moods: [], from: '', to: '' }))
    },
  }
}

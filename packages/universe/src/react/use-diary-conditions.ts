import { useEffect, useState } from 'react'

import { DiarySort, type GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import {
  DIARY_MEMORY_COUNT_ALL,
  diaryMemoryCountOption,
  diaryMemoryCountOptions,
  diaryMemoryCountRange,
  isKeywordSearchable,
  shouldAdoptCommitted,
} from '@cosimosi/memory'

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
  /** Whether the archive is showing oldest-first. The control is a toggle, so this is all it needs. */
  oldestFirst: boolean
  toggleSort: () => void
  /** Which live-memory-count choice is active, and the closed list the control offers. */
  memoryCount: string
  memoryCountOptions: readonly string[]
  setMemoryCount: (option: string) => void
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

// features/search-diary model ([D8][D9]): the archive's conditions — the keyword, the moods, the
// live-memory count and the order — held as drafts and committed only when they are usable. Free of
// platform primitives, so web and mobile share it verbatim rather than each re-deriving the debounce,
// the minimum-length rule and the count-choice table (ARCHITECTURE §3.5).
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
  const memoryCount = diaryMemoryCountOption(
    { min: value.minMemories, max: value.maxMemories },
    VALUES.encode.maxMemories,
  )
  // The ORDER is deliberately not a condition here: it narrows nothing, so 조건 지우기 must not undo
  // the direction the reader chose to read in ([D9]).
  const hasConditions =
    committedKeyword !== '' ||
    moods.length > 0 ||
    committedFrom !== '' ||
    committedTo !== '' ||
    memoryCount !== DIARY_MEMORY_COUNT_ALL

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
    oldestFirst: value.sort === DiarySort.OLDEST,
    toggleSort: () =>
      onChange((previous) => ({
        ...previous,
        sort: previous.sort === DiarySort.OLDEST ? DiarySort.NEWEST : DiarySort.OLDEST,
      })),
    memoryCount,
    memoryCountOptions: diaryMemoryCountOptions(VALUES.encode.maxMemories),
    setMemoryCount: (option) => {
      const range = diaryMemoryCountRange(option, VALUES.encode.maxMemories)
      onChange((previous) => ({ ...previous, minMemories: range.min, maxMemories: range.max }))
    },
    hasConditions,
    clear: () => {
      setKeywordDraft('')
      onChange((previous) => ({
        ...previous,
        query: '',
        moods: [],
        from: '',
        to: '',
        minMemories: undefined,
        maxMemories: undefined,
      }))
    },
  }
}

import { m } from '@cosimosi/i18n'

import { DIARY_MEMORY_COUNT_ALL } from './diary.ts'

// What `mood-color-copy.ts` does for the colour editor's closed sets, for the archive's own closed set
// of live-memory-count choices. It sits beside the option table rather than in a slice so both
// platforms' controls read one projection and cannot drift into two spellings of the same choice.
//
// The Korean copy is the poetic register a reader sees (별) while every name around it — the keys, the
// option table, this function — speaks of memories. That is the layer line rather than a synonym: what
// is counted is a diary's still-live `EpisodicMemory` rows, and the rendered body they wear a name for
// belongs to the rendering vocabulary this package deliberately does not hold (UL §4).
export function diaryMemoryCountLabel(option: string, maxMemories: number): string {
  const top = Math.max(1, Math.floor(maxMemories))
  if (option === DIARY_MEMORY_COUNT_ALL) return m.diary_search_memory_count_all()
  if (option === `${String(top)}+`) {
    return m.diary_search_memory_count_at_least({ count: String(top) })
  }
  if (option === '0') return m.diary_search_memory_count_none()
  return m.diary_search_memory_count_exact({ count: option })
}

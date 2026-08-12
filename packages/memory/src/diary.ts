import type { DiaryDayDto, DiaryDto } from '@cosimosi/api-client'
import { MOODS, type Mood } from '@cosimosi/emotion'

export interface DiarySplitMember {
  readonly episodicMemoryId: string
  readonly name: string
  readonly mood: string
}

export interface Diary {
  readonly id: string
  readonly body: string
  readonly diaryDate: string
  readonly createdUniverseTime: string
  readonly memories: readonly DiarySplitMember[]
}

// entities/diary api: maps the GetDiaries read DTOs into the shared diary read-model (§3.4
// proto→domain). The body is carried verbatim ([I2][D4]) and the split membership is copied
// as-is (soft-deleted memories already excluded server-side, so an all-let-go diary maps to an
// empty member list, [D3]). No derived or mutated value is introduced here.
export function diariesFromDtos(dtos: readonly DiaryDto[]): Diary[] {
  return dtos.map((dto) => ({
    id: dto.id,
    body: dto.body,
    diaryDate: dto.diaryDate,
    createdUniverseTime: dto.createdUniverseTime,
    memories: dto.memories.map((member) => ({
      episodicMemoryId: member.episodicMemoryId,
      name: member.name,
      mood: member.mood,
    })),
  }))
}

export interface DiaryDayMood {
  readonly mood: string
  readonly weight: number
}

export interface DiaryDay {
  readonly diaryDate: string
  readonly moods: readonly DiaryDayMood[]
}

// entities/diary api ([D12]): the FE mirror of the GetDiaryCalendar read. It stays NESTED rather than
// flattening to (date, mood, weight) triples, because a written day whose diaries launched nothing or
// whose memories were all let go arrives with an EMPTY `moods` list — in a flat list it would contribute
// no row at all and become indistinguishable from a day never written, which is exactly the distinction
// the neutral-outline mark rests on ([M3][X4]). The nesting is also [68]'s Go shape (DiaryDay/DiaryDayMood).
//
// `diaryDate` is carried as the verbatim `YYYY-MM-DD` string: `diary_date` is a user-entered LOCAL
// calendar date with no time component, so parsing it into a Date would apply a UTC shift and could move
// a mark a day for any user west of UTC ([W5]). The `weight` is `EffectiveStrength`-derived server-side
// and is copied verbatim — nothing is recomputed here ([M4][V3]).
export function diaryDaysFromDtos(dtos: readonly DiaryDayDto[]): DiaryDay[] {
  return dtos.map((day) => ({
    diaryDate: day.diaryDate,
    moods: day.moods.map((entry) => ({ mood: entry.mood, weight: entry.weight })),
  }))
}

// entities/diary lib ([D6]): the row preview. A prefix of the verbatim body, computed on the client —
// the wire carries no derived text, so there is no channel a summary could arrive through ([I2][D4]).
// Counts code points rather than UTF-16 units, so a lone surrogate can never be emitted. It is not
// grapheme-aware: a cut can still land inside a flag pair or split a combining mark from its base.
export function diaryPreview(body: string, length: number): string {
  const collapsed = body.replace(/\s+/gu, ' ').trim()
  if (length <= 0) return ''
  const points = Array.from(collapsed)
  if (points.length <= length) return collapsed
  return `${points.slice(0, length).join('')}…`
}

// entities/diary lib ([D6]): the distinct feelings a diary's live memories carry, in MOODS declaration
// order so the row's dots do not reshuffle with the server's row order. A diary whose memories were
// all let go — or that launched none — yields an empty list, and the row draws no dot rather than a
// NEUTRAL one, which would assert a feeling the writer never recorded ([M3][I1]).
export function diaryMoods(memories: readonly DiarySplitMember[]): Mood[] {
  const present = new Set(memories.map((member) => member.mood))
  return MOODS.filter((mood) => present.has(mood))
}

export interface DiaryTextSegment {
  readonly text: string
  readonly match: boolean
}

// entities/diary lib ([D9][D10]): splits a stretch of DIARY BODY around the search keyword so each app
// can mark the hits in its own primitive. Two guarantees hold the [D10] line — the parameter is named
// and typed as a diary body, so a memory's CurrentText/DecayStages can never be passed here; and the
// result is a segmentation of the input, never a match-centred excerpt, so the preview stays the
// prefix diaryPreview produced. Matching mirrors the server's ILIKE: case-insensitive and literal,
// so a typed `%` or `_` is a character rather than a wildcard.
//
// It searches the body itself rather than a lowercased copy on purpose: case folding is not
// length-preserving (`İ` folds to two code units), so an index taken in a folded copy would slide
// every later slice and mark characters the reader never typed.
export function highlightSegments(diaryBody: string, query: string): DiaryTextSegment[] {
  const needle = query.trim()
  if (needle === '') return [{ text: diaryBody, match: false }]

  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu')
  const segments: DiaryTextSegment[] = []
  let cursor = 0
  for (const hit of diaryBody.matchAll(pattern)) {
    // A pattern that can match empty would spin here; `needle` is non-empty, so a hit never is.
    if (hit[0] === '') break
    if (hit.index > cursor)
      segments.push({ text: diaryBody.slice(cursor, hit.index), match: false })
    segments.push({ text: hit[0], match: true })
    cursor = hit.index + hit[0].length
  }
  if (cursor < diaryBody.length) segments.push({ text: diaryBody.slice(cursor), match: false })
  return segments
}

// entities/diary lib ([D9]): the archive read refuses a keyword shorter than its minimum, so the
// condition is tested here before a read is ever issued — a refusal the reader cannot act on would
// otherwise replace the whole archive with an error.
export function isKeywordSearchable(keyword: string, minLength: number): boolean {
  const trimmed = keyword.trim()
  return trimmed === '' || trimmed.length >= minLength
}

/** An inclusive bound on how many still-live memories a diary has; an absent side is unbounded. */
export interface DiaryMemoryCountRange {
  readonly min?: number
  readonly max?: number
}

/** The option every choice is spelled as — `all`, an exact count, or the top count and above. */
export const DIARY_MEMORY_COUNT_ALL = 'all'

// entities/diary lib ([D9]): the live-memory-count condition, as the closed list of choices a control
// offers and the range each one means. A split holds at most `maxMemories` memories, so the top choice
// is "that many or more" rather than an exact count — a diary can only be reached from above there.
// Zero is a REAL choice, not the absence of one: a diary whose every memory was let go still lists
// ([I1]), and asking for those is a question the archive can answer.
//
// `maxMemories` is passed in rather than read here: this package holds no config seam, and the bound
// belongs to the encode contract (encode.max_memories) rather than to the reader.
export function diaryMemoryCountOptions(maxMemories: number): string[] {
  const top = Math.max(1, Math.floor(maxMemories))
  const exact = Array.from({ length: top }, (_, index) => String(index))
  return [DIARY_MEMORY_COUNT_ALL, ...exact, `${String(top)}+`]
}

export function diaryMemoryCountRange(option: string, maxMemories: number): DiaryMemoryCountRange {
  const top = Math.max(1, Math.floor(maxMemories))
  if (option === `${String(top)}+`) return { min: top }
  // Anything the list does not hold — a hand-edited link, a value a later build stopped offering —
  // reads as no condition rather than as a range nobody asked for. The digits are tested as a STRING
  // first: `Number('')` and `Number(' ')` are both 0, and an empty option must not mean "no stars".
  if (!/^\d+$/.test(option)) return {}
  const exact = Number(option)
  if (exact >= top) return {}
  return { min: exact, max: exact }
}

/** The reverse: which option a range spells, so a read (or an address bar) can be shown as a choice. */
export function diaryMemoryCountOption(range: DiaryMemoryCountRange, maxMemories: number): string {
  const top = Math.max(1, Math.floor(maxMemories))
  if (range.min === top && range.max === undefined) return `${String(top)}+`
  if (range.min !== undefined && range.min === range.max && range.min < top) {
    return String(range.min)
  }
  return DIARY_MEMORY_COUNT_ALL
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// entities/diary lib ([D8]): an inclusive date range is usable when each side is either absent or a
// full ISO date, and the range does not run backwards. Both halves matter: a half-typed date and an
// inverted range are each refused server-side, and a per-keystroke refusal would blank the archive
// while someone is still typing.
export function isDateRangeUsable(from: string, to: string): boolean {
  const start = from.trim()
  const end = to.trim()
  if (start !== '' && !ISO_DATE.test(start)) return false
  if (end !== '' && !ISO_DATE.test(end)) return false
  return start === '' || end === '' || start <= end
}

// entities/diary lib: whether a condition that changed outside the field — a Back navigation, a
// cleared filter — should replace what is currently typed. It must not when the incoming value is
// merely the trimmed form of the draft, or committing would eat a trailing space mid-phrase and
// replace the syllable a composing IME is still assembling.
export function shouldAdoptCommitted(draft: string, committed: string): boolean {
  return committed !== draft.trim()
}

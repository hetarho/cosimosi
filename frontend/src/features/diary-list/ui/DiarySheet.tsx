// Original-diary list/search (spec 28, 원본 일기로 별 찾기; filters extended in change 09) —
// CONTENT ONLY for the universe shell's telescope 일기 탭 (OverlayHost / explorer sheet). Picking
// a diary frames ALL of its stars and highlights them (the page wires onSelectDiary →
// focus SELECT_DIARY + shell setPeek); the host then collapses to a peek handle so the framed
// stars are visible. We never leave the universe (Architecture §3.1 — canvas-outside DOM).
// Read-only: the body shown is a short EXCERPT (the immutable original opens via recall — 헌법1).
// The chrome (header/peek/snap) is the OverlayHost's job; this emits intro + filters + list.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '@/shared/lib'
import { MoodChips } from '@/shared/ui'
import { type Mood } from '@/shared/config'
// 쿼리 정체성은 entities/memory가 소유한다(dormant/universe와 동일) — 소비처가 두 레이어
// (DiarySheet 읽기 + record-memory 무효화)에 걸쳐 있어, feature가 아니라 entity에 둔다(spec 28).
import { recordsQueryOptions, moodFromProto } from '@/entities/memory'
import { filterDiaries, type DiaryFilterEntry } from '../model/filters'

export interface DiarySheetProps {
  /** A diary was chosen — frame + highlight its stars (page wires to focus + peek). */
  onSelectDiary: (recordId: string) => void
}

export function DiarySheet({ onSelectDiary }: DiarySheetProps) {
  const { data, isPending, isError, error, refetch } = useQuery(recordsQueryOptions())
  const [query, setQuery] = useState('')
  const [moods, setMoods] = useState<Mood[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // RecordSummary(proto) → 순수 필터 입력(감정 enum → 도메인 문자열). change 09: moods facet.
  // starCount는 표시 전용(필터는 무시) — 제네릭 filterDiaries가 행 타입을 보존한다.
  const entries = useMemo<(DiaryFilterEntry & { starCount: number })[]>(
    () =>
      (data?.records ?? []).map((r) => ({
        recordId: r.recordId,
        entryDate: r.entryDate,
        bodyExcerpt: r.bodyExcerpt,
        moods: r.moods.map(moodFromProto),
        starCount: r.starCount,
      })),
    [data],
  )
  // 데이터에 실제로 있는 감정만 칩으로 — 빈 facet 칩을 줄인다.
  const available = useMemo(() => {
    const set = new Set<Mood>()
    for (const e of entries) for (const m of e.moods) set.add(m)
    return [...set]
  }, [entries])
  const filtered = useMemo(
    () => filterDiaries(entries, { query, moods, from: from || undefined, to: to || undefined }),
    [entries, query, moods, from, to],
  )
  const toggleMood = (m: Mood) =>
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  return (
    <>
      <p className="shrink-0 text-xs leading-relaxed text-white/45">
        일기를 고르면 그날 흩어진 별들을 한눈에 담는 자리로 날아가 강조해 보여줘요.
      </p>

      <input
        className="w-full shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
        placeholder="날짜·내용·감정으로 검색…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {available.length > 0 && (
        <MoodChips selected={moods} onToggle={toggleMood} available={available} />
      )}

      <div className="flex shrink-0 items-center gap-2 text-xs text-white/50">
        <input
          type="date"
          aria-label="시작 날짜"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-white/30"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span aria-hidden>—</span>
        <input
          type="date"
          aria-label="끝 날짜"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-white/30"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {isError && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-md bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-300">⚠ {errorMessage(error)}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 rounded-md bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20"
          >
            다시 시도
          </button>
        </div>
      )}

      {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}

      {data?.records && data.records.length === 0 && (
        <p className="rounded-md border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
          아직 일기가 없어요. 첫 일기를 적으면 여기 모여요.
        </p>
      )}

      {data?.records && data.records.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-white/40">검색 결과가 없어요.</p>
      )}

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        {filtered.map((r) => (
          <li key={r.recordId}>
            <button
              type="button"
              onClick={() => onSelectDiary(r.recordId)}
              className="flex w-full flex-col gap-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/10"
            >
              <span className="flex items-center justify-between text-xs text-white/45">
                <span>{r.entryDate}</span>
                <span>별 {r.starCount}개</span>
              </span>
              {/* ph-no-capture: 일기 발췌 — PostHog autocapture 차단(프라이버시 헌법; MemoryPanel과 동일). */}
              <span className="ph-no-capture line-clamp-2 text-sm text-white/80">{r.bodyExcerpt}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

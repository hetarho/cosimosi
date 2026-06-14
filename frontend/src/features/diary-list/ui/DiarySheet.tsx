// Original-diary list/search (spec 28, 원본 일기로 별 찾기) — CONTENT ONLY for the universe
// shell's OverlayHost (shared/ui, spec 31). Picking a diary frames ALL of its stars and
// highlights them (the page wires onSelectDiary → wayfinding.frameRecord + shell setPeek); the
// host then collapses to a peek handle so the framed stars are visible. We never leave the
// universe (Architecture §3.1 — canvas-outside DOM). Read-only: the body shown is a short
// EXCERPT (the immutable original opens via recall — 헌법1). The chrome (header/peek/snap) is
// the OverlayHost's job; this component emits only the intro + search + list.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '@/shared/lib'
// 쿼리 정체성은 entities/memory가 소유한다(dormant/universe와 동일) — 소비처가 두 레이어
// (DiarySheet 읽기 + record-memory 무효화)에 걸쳐 있어, feature가 아니라 entity에 둔다(spec 28).
import { recordsQueryOptions } from '@/entities/memory'

export interface DiarySheetProps {
  /** A diary was chosen — frame + highlight its stars (page wires to wayfinding + peek). */
  onSelectDiary: (recordId: string) => void
}

export function DiarySheet({ onSelectDiary }: DiarySheetProps) {
  const { data, isPending, isError, error, refetch } = useQuery(recordsQueryOptions())
  const [query, setQuery] = useState('')

  const records = data?.records
  const filtered = useMemo(() => {
    if (!records) return []
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter(
      (r) => r.bodyExcerpt.toLowerCase().includes(q) || r.entryDate.includes(q),
    )
  }, [records, query])

  return (
    <>
      <p className="shrink-0 text-xs leading-relaxed text-white/45">
        일기를 고르면 그날 흩어진 별들을 한눈에 담는 자리로 날아가 강조해 보여줘요.
      </p>

      <input
        className="w-full shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
        placeholder="날짜·내용으로 검색…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

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

      {records && records.length === 0 && (
        <p className="rounded-md border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
          아직 일기가 없어요. 첫 일기를 적으면 여기 모여요.
        </p>
      )}

      {records && records.length > 0 && filtered.length === 0 && (
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

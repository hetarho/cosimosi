// Original-diary list/search (spec 28, 원본 일기로 별 찾기) — a 2D HUD overlay OVER the persistent
// universe canvas (Architecture §3.1; we never leave the universe). Picking a diary frames ALL
// of its stars and highlights them (the page wires onSelectDiary → wayfinding.frameRecord); the
// sheet then "잦아든다" to a peek so the framed stars are visible. Stand-in for spec 31's overlay
// shell — when 31 lands this folds into its OverlayHost (panel='diary'), same as the 24 timelapse.
// Read-only: the body shown is a short EXCERPT (the immutable original opens via recall — 헌법1).
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '@/shared/lib'
// 쿼리 정체성은 entities/memory가 소유한다(dormant/universe와 동일) — 소비처가 두 레이어
// (DiarySheet 읽기 + record-memory 무효화)에 걸쳐 있어, feature가 아니라 entity에 둔다(spec 28).
import { recordsQueryOptions } from '@/entities/memory'

type View = 'open' | 'peek'

export interface DiarySheetProps {
  /** open = full list/search; peek = collapsed handle (after a diary was framed). */
  view: View
  /** Close the sheet entirely (the page also clears the diary highlight). */
  onClose: () => void
  /** Expand peek → open. */
  onExpand: () => void
  /** A diary was chosen — frame + highlight its stars (page wires to wayfinding). */
  onSelectDiary: (recordId: string) => void
}

export function DiarySheet({ view, onClose, onExpand, onSelectDiary }: DiarySheetProps) {
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

  // peek: 프레이밍 후 잦아든 손잡이 — 별을 가리지 않으면서 목록으로 돌아갈 길을 남긴다(1.1).
  if (view === 'peek') {
    return (
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-full border border-white/10 bg-black/55 pl-3 backdrop-blur">
        <button
          type="button"
          onClick={onExpand}
          className="py-1.5 text-sm text-white/80 transition hover:text-white"
        >
          📖 일기 목록 펼치기
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="일기 목록 닫기"
          className="px-2 py-1.5 text-white/45 transition hover:text-white/90"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    // 데스크톱(sm+): 좌측 패널. 모바일: 하단 시트. 우주는 뒤에 영속(31 셸 도입 전 페이지 합성).
    <div className="absolute inset-x-2 bottom-2 z-30 flex max-h-[70vh] flex-col gap-3 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:top-4 sm:left-4 sm:max-h-[calc(100dvh-2rem)] sm:w-80">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/80">원본 일기 — 별 찾기</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>
      <p className="text-xs leading-relaxed text-white/45">
        일기를 고르면 그날 흩어진 별들을 한눈에 담는 자리로 날아가 강조해 보여줘요.
      </p>

      <input
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
        placeholder="날짜·내용으로 검색…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-500/10 px-3 py-2">
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

      <ul className="flex flex-col gap-2 overflow-y-auto overscroll-contain">
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
    </div>
  )
}

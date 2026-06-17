// Dormant-star search (spec 12, 셸 오버레이로 전환 spec 31) — CONTENT ONLY for the universe
// shell's OverlayHost (shared/ui). Picking a star flies the camera to it in the universe (`/`) and
// re-ignites it (recall, 11) WITHOUT leaving the universe (the page wires onSelect →
// camera.focusStar + shell setPeek; this feature never imports the widget/page). The dormant
// list is a search aid — GetUniverse still renders the whole graph (these stars are NOT
// removed, just dim — 헌법2). Empty list → friendly guidance. Queried via dormantStarsQueryOptions
// (16): staleTime 5m, invalidated on recall success. Data source branches in the queryFn
// (demo vs server) — the shell is identical in both (acceptance 1.5/T007).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { capture, errorMessage, EVENTS } from '@/shared/lib'
import { virtualNowMs } from '@/shared/lib/demo'
import { moodLabel } from '@/shared/config'
import { dormantStarsQueryOptions } from '../api/list-dormant'

// 가상 시계(spec 19) 기준 경과일 — 데모 시간 머신이 보낸 날수가 "N일 전"에 반영된다.
function daysAgo(epochMs: number): number {
  return Math.floor((virtualNowMs() - epochMs) / 86_400_000)
}

export interface DormantSheetProps {
  /** A dormant star was chosen — the page flies to it (camera.focusStar) + peeks the sheet. */
  onSelect: (memoryId: string) => void
}

export function DormantSheet({ onSelect }: DormantSheetProps) {
  const { data: stars, isPending, isError, error, refetch } = useQuery(dormantStarsQueryOptions())
  const [query, setQuery] = useState('')

  // dormant_visit(18) — 기능 발견율. 목록이 처음 도착한 시점에 방문당 1회.
  const visitSent = useRef(false)
  useEffect(() => {
    if (!stars || visitSent.current) return
    visitSent.current = true
    capture(EVENTS.dormantVisit, { dormant_count: stars.length })
  }, [stars])

  const filtered = useMemo(() => {
    if (!stars) return []
    const q = query.trim().toLowerCase()
    if (!q) return stars
    return stars.filter(
      (s) =>
        moodLabel(s.mood).toLowerCase().includes(q) ||
        s.mood.includes(q) ||
        s.memoryId.toLowerCase().includes(q),
    )
  }, [stars, query])

  return (
    <>
      <p className="shrink-0 text-xs leading-relaxed text-white/45">
        오래 회상하지 않아 어두워진 별이에요. 고르면 그 별로 날아가 다시 회상할 수 있어요.
      </p>

      <input
        className="w-full shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
        placeholder="감정으로 검색 (예: 기쁨, sad)…"
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

      {stars && stars.length === 0 && (
        <p className="rounded-md border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
          잠든 별이 아직 없습니다. 별이 어두워질 만큼 시간이 지나면 여기 모여요.
        </p>
      )}

      {stars && stars.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-white/40">검색 결과가 없어요.</p>
      )}

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        {filtered.map((s) => (
          <li key={s.memoryId}>
            <button
              type="button"
              onClick={() => onSelect(s.memoryId)}
              className="flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
            >
              {/* brightness dot — dim stars read as faint */}
              <span
                className="h-3 w-3 shrink-0 rounded-full bg-white"
                style={{ opacity: Math.max(0.12, s.brightness) }}
              />
              <span className="text-sm text-white/85">{moodLabel(s.mood)}</span>
              <span className="ml-auto text-xs text-white/35">{daysAgo(s.lastRecalledAt)}일 전 회상</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

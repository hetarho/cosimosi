// Recall panel (spec 11, cached by 16) — a 2D HUD outside the R3F canvas (Architecture
// §3.1). Clicking a star selects it; the panel opens in a "dwelling" state and only
// after a ≥2s ACTIVE view (1.2/1.11) does it fire RecallMemory — which re-ignites the
// star (last_recalled_at=now) AND returns the immutable original Record (read-only, no
// edit path — constitution §1). The same 2s threshold accumulates the co-recall pair
// (1.3). The Record is immutable → cached forever (['record', id]): a re-open shows the
// body instantly from cache while the touch still fires in the background (16, 1.5).
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { useQueryClient } from '@tanstack/react-query'
import type { Record as RecordMsg } from '@/shared/api'
import { capture, EVENTS } from '@/shared/lib'
import {
  dormantInvalidateKey,
  isDormant,
  moodFromProto,
  recordQueryKey,
  useMemoryStore,
} from '@/entities/memory'
import { moodLabel } from '@/shared/config'
import { recallMemory } from '../api/recall'
import { DWELL_MS } from '../model'
import { useRecallStore } from '../model/store'
import { NeighborNav } from './NeighborNav'

type Phase = 'dwelling' | 'loading' | 'shown' | 'error'

/** Inner panel for one selected star. Keyed by memoryId so a new selection remounts it
 *  fresh (state resets without a setState-in-effect). */
function RecallView({ memoryId }: { memoryId: string }) {
  const select = useMemoryStore((s) => s.select)
  const recordActiveView = useRecallStore((s) => s.recordActiveView)
  const queryClient = useQueryClient()
  // 재열람 = 캐시에서 즉시 본문(스피너 없음, 1.5). 원본은 불변(헌법 §1)이라 안전하다.
  const [record, setRecord] = useState<RecordMsg | null>(
    () => queryClient.getQueryData<RecordMsg>(recordQueryKey(memoryId)) ?? null,
  )
  const [phase, setPhase] = useState<Phase>(record ? 'shown' : 'dwelling')

  useEffect(() => {
    let cancelled = false
    // ≥2s active dwell → a real recall (1.2/1.11). A glance (<2s: closed or star
    // switched) clears the timer → no touch, no co-recall. 캐시 히트여도 touch는 매번
    // 발사한다(재점화 의미론, 16 — 캐시가 touch를 생략하면 감쇠 모델이 굶는다); 캐시를
    // 보여주는 중의 touch 실패는 비차단(다음 열람에 재시도).
    const timer = setTimeout(() => {
      recordActiveView(memoryId) // co-recall pair with the previous active view (1.3)
      // recall_open(18) — 회상 발화 시점(터치 직전)의 활성도로 잠든 별 재점화 여부를 판단.
      const star = useMemoryStore.getState().stars.find((s) => s.id === memoryId)
      capture(EVENTS.recallOpen, {
        is_dormant: star ? isDormant(star.memory.lastRecalledAt, Date.now()) : false,
      })
      const hasCached = queryClient.getQueryData(recordQueryKey(memoryId)) != null
      if (!hasCached) setPhase('loading')
      recallMemory(memoryId)
        .then((r) => {
          // cancelled 가드가 캐시 쓰기보다 먼저다: 로그아웃·출처 리셋(queryClient.clear)
          // 뒤에 늦게 도착한 응답이 이전 사용자의 기록을 빈 캐시에 재주입하면 안 된다
          // (언마운트 = cancelled). 별 전환으로 잃는 시드는 다음 열람이 다시 채운다.
          if (cancelled) return
          if (r) {
            // 영구 시드(staleTime ∞ — app/query-client의 record 기본값): 다음 열람은 캐시로.
            queryClient.setQueryData(recordQueryKey(memoryId), r)
            // 회상된 별은 잠에서 깸 → 잠든 별 목록 무효화(1.6).
            void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
            setRecord(r)
            setPhase('shown')
          } else if (!hasCached) {
            setPhase('error')
          }
        })
        .catch((e: unknown) => {
          // 캐시 표시 중의 touch 실패는 화면엔 비차단이지만 침묵하면 재점화 유실(감쇠 모델
          // 굶주림)을 영영 모른다 → Sentry에 기록(스펙 §변이별; DSN 없으면 no-op).
          Sentry.captureException(e)
          if (!cancelled && !hasCached) setPhase('error')
        })
    }, DWELL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [memoryId, recordActiveView, queryClient])

  return (
    <div className="flex w-96 max-w-[90vw] flex-col gap-3 rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/80">회상 — 원본 일기</h2>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="닫기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>

      {phase === 'dwelling' && (
        <p className="text-sm text-white/50">별을 바라보는 중… (2초간 머무르면 회상됩니다)</p>
      )}
      {phase === 'loading' && <p className="text-sm text-white/50">기억을 불러오는 중…</p>}
      {phase === 'error' && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
          ⚠ 이 기억을 회상하지 못했어요.
        </p>
      )}

      {phase === 'shown' && record && (
        // Read-only: no edit/delete controls (constitution §1, acceptance 1.1).
        // ph-no-capture: 일기 원문 영역 — PostHog autocapture가 이 서브트리를 아예
        // 건드리지 않게 한다(프라이버시 헌법 3; mask_all_text 위의 이중 가드).
        <article className="ph-no-capture flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <span>{record.entryDate}</span>
            <span>·</span>
            <span>{moodLabel(moodFromProto(record.mood))}</span>
            <span>·</span>
            <span>강도 {record.intensity.toFixed(2)}</span>
          </div>
          <p className="selectable whitespace-pre-wrap text-sm leading-relaxed text-white/85">
            {record.body}
          </p>
        </article>
      )}

      <NeighborNav />
    </div>
  )
}

export function MemoryPanel() {
  const selectedId = useMemoryStore((s) => s.selectedId)
  if (!selectedId) return null
  return <RecallView key={selectedId} memoryId={selectedId} />
}

// Recall panel (spec 11, cached by 16) — a 2D HUD outside the R3F canvas (Architecture
// §3.1). Clicking a star selects it; the panel opens in a "dwelling" state and only
// after a ≥2s ACTIVE view (1.2/1.11) does it fire RecallMemory — which re-ignites the
// star (last_recalled_at=now) AND returns the immutable original Record (read-only, no
// edit path — constitution §1). The same 2s threshold accumulates the co-recall pair
// (1.3). The Record is immutable → cached forever (['record', id]): a re-open shows the
// body instantly from cache while the touch still fires in the background (16, 1.5).
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { useSelector } from '@xstate/react'
import { useQueryClient } from '@tanstack/react-query'
import type { Record as RecordMsg } from '@/shared/api'
import { capture, EVENTS } from '@/shared/lib'
import { isDemoMode, virtualNowMs } from '@/shared/lib/demo'
import {
  dormantInvalidateKey,
  focusActor,
  fragmentTextQueryKey,
  isDormant,
  moodFromProto,
  recordQueryKey,
  selectFocusedStarId,
  universeInvalidateKey,
  useMemoryStore,
} from '@/entities/memory'
import { moodLabel } from '@/shared/config'
import { recallMemory } from '../api/recall'
import { DWELL_MS } from '../model'
import { useRecallStore } from '../model/store'
import { NeighborNav } from './NeighborNav'

type Phase = 'dwelling' | 'loading' | 'shown' | 'error'

/** Inner panel for one selected star. Keyed by memoryId so a new selection remounts it
 *  fresh (state resets without a setState-in-effect). onOpenEvolution / onSeeDiaryStars are
 *  wired by the page (FSD: recall doesn't import the evolution/wayfinding features — the page
 *  composes them). */
function RecallView({
  memoryId,
  onOpenEvolution,
  onSeeDiaryStars,
}: {
  memoryId: string
  onOpenEvolution?: (memoryId: string) => void
  onSeeDiaryStars?: (recordId: string) => void
}) {
  const recordActiveView = useRecallStore((s) => s.recordActiveView)
  const queryClient = useQueryClient()
  // 이 별이 가리키는 원본 일기 id(spec 28) — "이 일기의 다른 별들 보기"의 그룹 키. 별이 사라지지
  // 않는 한(헌법2) 안정적이라 selector가 값으로 비교해 불필요한 리렌더는 없다.
  const recordId = useMemoryStore((s) => s.stars.find((st) => st.id === memoryId)?.memory.recordId ?? '')
  // 재열람 = 캐시에서 즉시 본문(스피너 없음, 1.5). 원본은 불변(헌법 §1)이라 안전하다.
  const [record, setRecord] = useState<RecordMsg | null>(
    () => queryClient.getQueryData<RecordMsg>(recordQueryKey(memoryId)) ?? null,
  )
  // 그 별의 조각 텍스트(spec 28) — 원본과 같은 불변·영구 캐시에서 즉시(재열람 무스피너).
  const [fragmentText, setFragmentText] = useState<string>(
    () => queryClient.getQueryData<string>(fragmentTextQueryKey(memoryId)) ?? '',
  )
  // 기본은 조각만; 사용자가 "원본 일기 전체 보기"를 누르면 불변 원본 전체로 펼친다.
  const [showFull, setShowFull] = useState(false)
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
        is_dormant: star ? isDormant(star.memory.lastRecalledAt, virtualNowMs()) : false,
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
            // 조각 텍스트(spec 28)도 같은 불변·영구 캐시 prefix에 시드한다.
            queryClient.setQueryData(recordQueryKey(memoryId), r.record)
            queryClient.setQueryData(fragmentTextQueryKey(memoryId), r.fragmentText)
            // 회상된 별은 잠에서 깸 → 잠든 별 목록 무효화(1.6).
            void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
            // 데모 재점화(spec 19): demoMarkRecalled가 전진시킨 lastRecalledAt을 우주에
            // 반영(refetch→mergeStars max 통과→별이 다시 밝아짐). 비데모는 staleTime이 소유.
            if (isDemoMode()) {
              void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
            }
            setRecord(r.record)
            setFragmentText(r.fragmentText)
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
          onClick={() => focusActor.send({ type: 'DISMISS' })}
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
          {(() => {
            // 별 → 조각 → 원본 3겹(spec 28): 기본은 이 별의 조각 텍스트(있을 때), "원본 일기
            // 전체 보기"를 누르면 불변 Record 전체로 펼친다. 조각이 없거나(단일 조각) 본문과
            // 같으면 그냥 원본 전체만 보인다(토글 숨김).
            const hasFragment = fragmentText !== '' && fragmentText !== record.body
            const shownText = hasFragment && !showFull ? fragmentText : record.body
            return (
              <>
                <p className="selectable whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                  {shownText}
                </p>
                {hasFragment && (
                  <button
                    type="button"
                    onClick={() => setShowFull((v) => !v)}
                    className="w-fit text-xs text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline"
                  >
                    {showFull ? '조각만 보기' : '원본 일기 전체 보기'}
                  </button>
                )}
              </>
            )
          })()}
          {/* 동선 버튼 묶음: 변천사(24) / 이 일기의 다른 별들(28). 편집·삭제 없음(헌법1). */}
          <div className="mt-1 flex flex-wrap gap-2">
            {/* 변천사 보기(24): 이 별이 변해 온 길을 우주 위 오버레이로 연다(우주를 떠나지 않음). */}
            {onOpenEvolution && (
              <button
                type="button"
                onClick={() => onOpenEvolution(memoryId)}
                className="w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-mood-pink/60 hover:text-white"
              >
                변천사 보기
              </button>
            )}
            {/* 이 일기의 다른 별들 보기(28): 같은 record_id 별들을 조망 위치로 프레이밍+강조. */}
            {onSeeDiaryStars && recordId && (
              <button
                type="button"
                onClick={() => onSeeDiaryStars(recordId)}
                className="w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-mood-pink/60 hover:text-white"
              >
                이 일기의 다른 별들 보기
              </button>
            )}
          </div>
        </article>
      )}

      <NeighborNav />
    </div>
  )
}

export function MemoryPanel({
  onOpenEvolution,
  onSeeDiaryStars,
}: {
  onOpenEvolution?: (memoryId: string) => void
  onSeeDiaryStars?: (recordId: string) => void
} = {}) {
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  if (!selectedId) return null
  return (
    <RecallView
      key={selectedId}
      memoryId={selectedId}
      onOpenEvolution={onOpenEvolution}
      onSeeDiaryStars={onSeeDiaryStars}
    />
  )
}

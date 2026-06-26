// Selected-diary card (spec 31 모바일 하드닝) — 일기 목록에서 일기 하나를 고르면 그 일기를 하단에
// 보여주는 카드. 목록(DiarySheet)의 peek 상태를 대신한다(어떤 일기를 조망 중인지 명시). 카메라는
// 그 일기의 모든 별을 위쪽에 프레이밍하고, 빈 우주를 탭하면 해제·복귀한다(페이지가 onPointerMissed로
// 배선). 원문 전체는 헌법1상 회상에서만 — 여기선 발췌만, 별을 탭하면 그 조각을 회상한다.
import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recordsQueryOptions } from '@/entities/memory'

export interface DiaryCardProps {
  /** 조망 중인 일기(record_id). 캐시된 ListRecords에서 발췌·날짜·별 개수를 찾는다. */
  recordId: string | null
  /** 목록으로 — peek를 풀어 일기 목록을 다시 펼친다. */
  onExpand: () => void
  /** 닫기 — 강조 해제 + 패널 닫기(우주로 복귀). */
  onClose: () => void
}

/** recordId로 키잉해 다른 일기를 조망하면 발췌 펼침 상태가 자연히 리셋된다(setState-in-effect 없이). */
export function DiaryCard({ recordId, onExpand, onClose }: DiaryCardProps) {
  return <DiaryCardView key={recordId ?? '∅'} recordId={recordId} onExpand={onExpand} onClose={onClose} />
}

function DiaryCardView({ recordId, onExpand, onClose }: DiaryCardProps) {
  const { data } = useQuery(recordsQueryOptions())
  const rec = recordId ? data?.records.find((r) => r.recordId === recordId) : undefined

  // 발췌 펼치기(change 32): 기본은 접힌 상태(최대 높이 내 스크롤), "더 보기"로 발췌 전체를 펼친다. 고정 3줄
  // 클램프(line-clamp-3)로 토막내지 않는다. 토글은 접힌 상태에서 실제로 넘칠 때만 보인다(짧은 일기엔 군더더기 없음).
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const excerptRef = useRef<HTMLParagraphElement>(null)
  // 접힌 상태에서 내용이 최대 높이를 넘으면 "더 보기"를 노출한다(DOM 레이아웃 측정 = 외부 동기화). 펼친 동안은
  // 다시 재지 않는다(canExpand 유지).
  useLayoutEffect(() => {
    const el = excerptRef.current
    if (el && !expanded) setCanExpand(el.scrollHeight > el.clientHeight + 1)
  }, [rec?.bodyExcerpt, expanded])

  return (
    <div className="absolute inset-x-2 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2">
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs text-white/50">
          {rec ? `${rec.entryDate} · 별 ${rec.starCount}개` : '일기'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            className="rounded-md px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            목록
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-md text-white/45 transition hover:text-white/90"
          >
            ✕
          </button>
        </div>
      </header>
      {rec && (
        <div className="flex flex-col gap-1">
          {/* ph-no-capture: 일기 발췌 — PostHog autocapture 차단(프라이버시 헌법). 펼치면 최대 높이 내 스크롤. */}
          <p
            ref={excerptRef}
            className={`ph-no-capture text-sm leading-relaxed whitespace-pre-wrap text-white/80 ${
              expanded ? 'max-h-48 overflow-y-auto' : 'max-h-16 overflow-hidden'
            }`}
          >
            {rec.bodyExcerpt}
          </p>
          {(canExpand || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-fit text-xs text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline"
            >
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-white/35">
        위에 떠오른 별들이 이 일기에서 태어났어요 — 별을 톡 치면 그 조각을 회상하고, 빈 곳을 누르면 돌아갑니다.
      </p>
    </div>
  )
}

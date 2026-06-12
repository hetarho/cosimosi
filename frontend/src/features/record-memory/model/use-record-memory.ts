// Record flow (spec 21, reshaped by the review step): "별로 분해" → SegmentMemory
// (동기 미리보기, 저장 없음) → 사용자가 조각·감정을 검토/수정/추가 → "별 띄우기" →
// RecordMemory(확정 조각 동기 fan-out — memory_ids 즉시 확정) → 즉시 GetUniverse
// invalidate로 별이 바로 도착(탄생 연출), 시냅스는 임베딩이 비동기라 지연 refetch로.
// body/entryDate/fragments stay in the draft (never the render store).
// 체험 모드는 이 훅을 쓰지 않는다(폼이 숨겨지고 DemoSimPanel이 직접 기록).
import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { bodyLengthBucket, capture, EVENTS } from '@/shared/lib'
import { universeInvalidateKey } from '@/entities/memory'
import {
  BODY_TOO_LONG_MSG,
  EMPTY_FRAGMENT_MSG,
  MAX_BODY_CHARS,
  recordErrorMessage,
  recordMemory,
  segmentErrorMessage,
  segmentMemory,
} from '../api/record-memory'
import { useDraftStore } from './draft-store'

// 확정 조각 제출 후 시냅스(임베드 잡 → KNN 링크)가 생길 시간(§4.6 "연결은 다음
// refetch에서"). 별 자체는 제출 직후의 즉시 invalidate로 이미 도착해 있다.
const SYNAPSE_REFETCH_DELAYS_MS = [8_000]

// 연속 기록을 하나로 코알레스: 마지막 기록 기준으로만 체인을 다시 건다(그 refetch가
// 그동안의 별·시냅스를 전부 포함한다) — K개 연속 제출이 2K번의 우주 refetch가 되지 않게.
let syncTimers: ReturnType<typeof setTimeout>[] = []

/** 시냅스 도착 동기화 체인: 지연 invalidate. */
function scheduleSynapseSync(queryClient: QueryClient, delays: number[]) {
  for (const t of syncTimers) clearTimeout(t)
  syncTimers = delays.map((d, i) =>
    setTimeout(() => {
      // queryClient는 앱 수명 싱글턴이라 페이지를 떠나도 안전하다(비활성 쿼리는
      // stale 마킹 → 다음 마운트에서 refetch).
      void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
      if (i === delays.length - 1) syncTimers = []
    }, d),
  )
}

/** 본문 사전 검증(17) — 분해와 제출이 공유. 통과하면 null, 실패하면 에러 카피. */
function bodyError(body: string): string | null {
  if (!body.trim()) return '일기 본문을 입력하세요'
  // 코드포인트 기준 — 서버 RuneCount와 동일 단위
  if ([...body].length > MAX_BODY_CHARS) return BODY_TOO_LONG_MSG
  return null
}

export function useRecordMemory() {
  const queryClient = useQueryClient()

  /** "별로 분해": 동기 SegmentMemory 미리보기 → 검토 단계로. 아무것도 저장되지 않는다. */
  const segment = useCallback(async () => {
    const draft = useDraftStore.getState()
    if (draft.status === 'segmenting' || draft.status === 'submitting') return
    const err = bodyError(draft.body)
    if (err) {
      draft.setError(err)
      return
    }
    draft.setStatus('segmenting')
    try {
      const fragments = await segmentMemory(draft.body)
      useDraftStore.getState().setFragments(fragments) // → review 단계
    } catch (e) {
      useDraftStore.getState().setError(segmentErrorMessage(e))
    }
  }, [])

  /** "별 띄우기": 검토를 마친 확정 조각으로 RecordMemory — 별이 즉시 태어난다. */
  const submit = useCallback(async () => {
    const draft = useDraftStore.getState()

    if (draft.status === 'submitting') return // guard a fast double-submit
    const err = bodyError(draft.body)
    if (err) {
      draft.setError(err)
      return
    }
    if (draft.fragments.length === 0) {
      draft.setError('띄울 조각이 없어요 — 먼저 일기를 분해해 주세요.')
      return
    }
    if (draft.fragments.some((f) => !f.text.trim())) {
      draft.setError(EMPTY_FRAGMENT_MSG)
      return
    }

    // record_memory 공통 속성(18, 3.2) — 본문은 길이 버킷으로만 환원, 원문은 싣지
    // 않는다. mood는 기존 대시보드 연속성용 상수 'auto'(수동 토글이 검토 단계로
    // 대체되어 기록 단위 mood가 사라짐); 조각 수가 새 신호다.
    const metric = {
      mood: 'auto',
      fragment_count: draft.fragments.length,
      body_length_bucket: bodyLengthBucket([...draft.body].length),
    }
    useDraftStore.getState().setStatus('submitting')

    try {
      await recordMemory({
        body: draft.body,
        entryDate: draft.entryDate,
        fragments: draft.fragments,
        // 드래프트 수명 동안 고정된 nonce — 실패 후 재제출이 같은 키로 가서 서버가
        // 중복 record를 만들지 않는다. 조각을 수정하면 nonce가 새로 굴러(draft-store)
        // 내용이 달라진 재제출이 옛 커밋으로 dedup되어 수정이 증발하는 일을 막는다.
        idempotencyKey: `rec-${draft.submitNonce}`,
      })
      useDraftStore.getState().reset()
      capture(EVENTS.recordMemory, { ...metric, success: true })
      // 확정 조각은 동기 fan-out이라 별이 이미 서버에 있다 — 즉시 당겨와 탄생
      // 연출과 함께 띄우고, 시냅스(비동기 임베딩)는 지연 refetch로 실어 온다.
      void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
      scheduleSynapseSync(queryClient, SYNAPSE_REFETCH_DELAYS_MS)
    } catch (e) {
      // 서버 검증(InvalidArgument, 17)은 입력을 고치면 되는 문제라 구체 메시지로
      // 표면화한다(2.8).
      capture(EVENTS.recordMemory, { ...metric, success: false })
      useDraftStore.getState().setError(recordErrorMessage(e))
    }
  }, [queryClient])

  return { segment, submit }
}

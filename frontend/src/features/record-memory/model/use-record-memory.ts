// Record flow (spec 21, supersedes spec 10's single optimistic star): submit →
// RecordMemory(record_id 확정) → "조각내는 중"(segmenting) → 지연 GetUniverse
// invalidate로 N개 조각 별이 병합 도착(merge appends — addStars 의미론, spec 16
// 1.4). 조각 수·감정을 클라가 모르므로 낙관 별은 띄우지 않는다(헌법6 — 별은 비동기
// 도착). body/entryDate stay in the draft (never the render store).
import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { bodyLengthBucket, capture, EVENTS } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { moodFromProto, universeInvalidateKey } from '@/entities/memory'
import {
  BODY_TOO_LONG_MSG,
  MAX_BODY_CHARS,
  recordErrorMessage,
  recordMemory,
} from '../api/record-memory'
import { useDraftStore } from './draft-store'

// 워커가 extract(조각 fan-out)→embed(시냅스)를 만들 시간(§4.6 "연결은 다음 refetch
// 에서"). 가벼운 재시도 2회(spec 21, 1.7) — 첫 invalidate가 조각 별을, 둘째가 늦게
// 생긴 시냅스까지 실어 온다. 무한/조건 폴링 금지(spec 16): 이후는 stale 안전망 몫.
const REFETCH_DELAYS_MS = [3_500, 10_000]
// 데모는 fan-out이 동기(demoAddRecord)라 바로 당겨온다.
const DEMO_REFETCH_DELAYS_MS = [800]

// 연속 기록을 하나로 코알레스: 마지막 기록 기준으로만 체인을 다시 건다(그 refetch가
// 그동안의 별·시냅스를 전부 포함한다) — K개 연속 제출이 2K번의 우주 refetch가 되지 않게.
let syncTimers: ReturnType<typeof setTimeout>[] = []

/** 조각 도착 동기화 체인: 지연 invalidate 1~2회, 마지막에 segmenting 해제. */
function scheduleFragmentSync(queryClient: QueryClient, delays: number[]) {
  for (const t of syncTimers) clearTimeout(t)
  syncTimers = delays.map((d, i) =>
    setTimeout(() => {
      // queryClient는 앱 수명 싱글턴이라 페이지를 떠나도 안전하다(비활성 쿼리는
      // stale 마킹 → 다음 마운트에서 refetch).
      void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
      if (i === delays.length - 1) {
        syncTimers = []
        const draft = useDraftStore.getState()
        if (draft.status === 'segmenting') draft.setStatus('idle')
      }
    }, d),
  )
}

export function useRecordMemory() {
  const queryClient = useQueryClient()
  const submit = useCallback(async () => {
    const draft = useDraftStore.getState()

    if (draft.status === 'submitting') return // guard a fast double-submit
    if (!draft.body.trim()) {
      useDraftStore.getState().setError('일기 본문을 입력하세요')
      return
    }
    // 사전 길이 차단(17): 서버도 같은 상한으로 거부하지만, 와이어 왕복 없이 즉시 안내.
    const bodyCodePoints = [...draft.body].length // 코드포인트 기준 — 서버 RuneCount와 동일 단위
    if (bodyCodePoints > MAX_BODY_CHARS) {
      useDraftStore.getState().setError(BODY_TOO_LONG_MSG)
      return
    }

    const manual = draft.manualMood
    // record_memory 공통 속성(18, 3.2) — 본문은 길이 버킷으로만 환원, 원문은 싣지
    // 않는다. 감정은 AI 감지가 기본(21)이라 수동 토글일 때만 실제 mood를 싣는다.
    const metric = {
      mood: manual ? moodFromProto(draft.mood) : 'auto',
      body_length_bucket: bodyLengthBucket(bodyCodePoints),
    }
    useDraftStore.getState().setStatus('submitting')
    // 출처 가드(18): 제출 중 체험↔실서버 전환이 일어나면 이벤트·refetch를 이전
    // 출처에 귀속시키지 않는다(이전엔 temp 별 생존 여부로 판별 — 21에서 temp 별 제거).
    const wasDemo = isDemoMode()

    try {
      await recordMemory({
        body: draft.body,
        entryDate: draft.entryDate,
        ...(manual ? { mood: draft.mood, intensity: draft.intensity } : {}),
        // 드래프트 수명 동안 고정된 nonce — 실패 후 재제출이 같은 키로 가서 서버가
        // 중복 record를 만들지 않는다(성공 reset()에서만 다음 일기용으로 갱신).
        idempotencyKey: `rec-${draft.submitNonce}`,
      })
      const sameSource = isDemoMode() === wasDemo
      // 출처가 바뀌었으면(체험↔실서버) 이벤트·refetch·segmenting 모두 이전 출처
      // 소유라 건너뛴다 — 드래프트만 비우고 끝(서버엔 커밋돼 있음).
      useDraftStore.getState().reset()
      if (!sameSource) return
      capture(EVENTS.recordMemory, { ...metric, success: true })
      // 본문 비우고 "조각내는 중" 표시(1.7) → 지연 refetch가 N개 조각 별을 병합으로
      // 실어 온다(머지가 새 서버 별을 뒤에 append — addStars 의미론, spec 16 1.4).
      useDraftStore.getState().setStatus('segmenting')
      scheduleFragmentSync(queryClient, isDemoMode() ? DEMO_REFETCH_DELAYS_MS : REFETCH_DELAYS_MS)
    } catch (e) {
      // 서버 검증(InvalidArgument, 17)은 입력을 고치면 되는 문제라 구체 메시지로
      // 표면화한다(2.8). 실패 이벤트도 출처 유지 시에만 — 성공 경로와 동일한 귀속 가드.
      if (isDemoMode() === wasDemo) capture(EVENTS.recordMemory, { ...metric, success: false })
      useDraftStore.getState().setError(recordErrorMessage(e))
    }
  }, [queryClient])

  return { submit }
}

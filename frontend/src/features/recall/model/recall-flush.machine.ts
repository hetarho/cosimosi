import { setup, assign, fromPromise, createActor } from 'xstate'
import { capture, EVENTS } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { useSynapseStore } from '@/entities/synapse'
import { reinforceLinks } from '../api/recall'
import {
  CO_RECALL_DELTA,
  DEBOUNCE_IDLE_MS,
  createSession,
  drainDeltas,
  hasPending,
  onActiveView,
  pairKey,
  type RecallSession,
} from './co-recall'

// 회상 flush 머신(features/recall/model, spec 39 P4) — 구 recall-store의 디바운스·직렬화·재시도
// 보일러플레이트(setTimeout + inFlight 플래그 + try/catch + 세션 스왑 가드)를 명시적 FSM으로:
//   idle → (RECORD_VIEW)accumulating → (after DEBOUNCE)flushing → (성공)idle/accumulating
// `after`가 디바운스, invoke가 직렬화(flushing엔 재flush 핸들러 없음 = 동시 flush 불가), onError가 재시도.
// 출처 경계 리셋은 RESET이 flushing을 이탈시켜 invoke를 취소 → 그 결과가 새 세션에 안 적용된다(구
// get().session===s 가드를 구조로 대체). 순수 TS(three/React/DOM 미의존, 헌법4) — setTimeout/crypto는
// RN-safe, beforeunload flush는 ui(페이지). 모듈 싱글턴(구 useRecallStore 동형 수명).
//
// context.session은 누적 Map(deltas)을 담는 "내부 가변 버퍼"다 — flush로 비워지고
// 반응형 select 대상이 아니라, 고빈도 누적은 in-place 변형(assign 불변 모델 밖, 구 zustand와 동일)으로
// 둔다. 수명주기 의미가 있는 변경(batchId 회전·리셋·inFlight)만 assign.

type FlushItem = { aId: string; bId: string; deltaWeight: number }

interface Ctx {
  session: RecallSession
  /** 전송 중 배치(드레인 스냅샷) — 성공 시 비우고, 실패 시 같은 batchId로 재병합. */
  inFlight: { items: FlushItem[]; batchId: string } | null
}

type Ev = { type: 'RECORD_VIEW'; id: string } | { type: 'FLUSH' } | { type: 'RESET' }

const newBatchId = (): string => crypto.randomUUID()

export const recallFlushMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev },
  actors: {
    flush: fromPromise(({ input }: { input: { items: FlushItem[]; batchId: string } }) =>
      reinforceLinks(input.items, input.batchId),
    ),
  },
  guards: {
    pending: ({ context }) => hasPending(context.session),
  },
  actions: {
    // 버튼 회상 1건 누적(의도적 회상 — change 35; RECORD_VIEW는 회상 성사 시에만 보낸다). 직전 회상과 다른
    // 별이면 페어 +CO_RECALL_DELTA(간격 무관 고정 — change 22). 데모면 그 엣지 weight를 로컬로 올려 굵어짐을 즉시 보인다(영속은 flush 경로 — 데모는 no-op).
    accumulate: ({ context, event }) => {
      if (event.type !== 'RECORD_VIEW') return
      const prev = context.session.lastViewedId
      onActiveView(context.session, event.id) // session in-place(누적 버퍼)
      if (prev && prev !== event.id && isDemoMode()) {
        useSynapseStore.getState().bumpEdgeWeight(prev, event.id, CO_RECALL_DELTA)
      }
    },
    // flushing 진입: 누적분을 inFlight로 스냅샷 + session.deltas에서 즉시 제거 → 전송 중 들어온 열람이
    // 이번 배치에 중복되지 않고 다음 배치로 쌓인다(구 store의 "drain 후 즉시 삭제"). 제거는 side effect.
    drain: assign({
      inFlight: ({ context }) => {
        const { items, batchId } = drainDeltas(context.session)
        for (const it of items) context.session.deltas.delete(pairKey(it.aId, it.bId))
        return { items, batchId }
      },
    }),
    // reinforce_flush(18) — 성공 배치만 1회(재시도는 같은 batchId로 합쳐짐). rotateBatch 전에 호출해야
    // inFlight가 살아 있다(v5: 같은 전이의 assign 갱신이 이후 액션에 보임 — clear/rotate를 먼저 두면 0).
    captureFlush: ({ context }) => {
      if (context.inFlight) capture(EVENTS.reinforceFlush, { pair_count: context.inFlight.items.length })
    },
    // 성공: batchId 회전(누적 Map은 유지 — 전송 중 들어온 페어 보존), inFlight 비움.
    rotateBatch: assign({
      session: ({ context }) => ({ ...context.session, batchId: newBatchId() }),
      inFlight: null,
    }),
    // 실패: 드레인분을 같은 batchId로 재병합(서버가 batchId로 dedup → 재전송 이중가산 없음).
    remerge: ({ context }) => {
      if (!context.inFlight) return
      for (const it of context.inFlight.items) {
        const k = pairKey(it.aId, it.bId)
        context.session.deltas.set(k, (context.session.deltas.get(k) ?? 0) + it.deltaWeight)
      }
    },
    clearInFlight: assign({ inFlight: null }),
    resetSession: assign({ session: () => createSession(newBatchId()), inFlight: null }),
  },
}).createMachine({
  id: 'recallFlush',
  // context는 함수 — 액터마다 새 session(가변 Map). 정적 객체로 두면 모든 액터가 같은 Map을 공유해
  // in-place 누적이 섞인다(누적 버퍼라 특히 중요).
  context: () => ({ session: createSession(newBatchId()), inFlight: null }),
  initial: 'idle',
  on: {
    // 출처 경계 리셋(로그아웃·데모 전환, 16) — 어느 상태에서든. flushing 중이면 상태 이탈로 invoke가
    // 취소돼 그 결과가 새 세션에 적용되지 않는다.
    RESET: { target: '.idle', actions: 'resetSession' },
  },
  states: {
    idle: {
      on: { RECORD_VIEW: { target: 'accumulating', actions: 'accumulate' } },
    },
    accumulating: {
      after: {
        // 유휴 디바운스: 보낼 게 있으면 flush, 없으면(같은 별 재열람 등) idle로.
        [DEBOUNCE_IDLE_MS]: [{ guard: 'pending', target: 'flushing' }, { target: 'idle' }],
      },
      on: {
        RECORD_VIEW: { target: 'accumulating', reenter: true, actions: 'accumulate' }, // 디바운스 재시작
        FLUSH: [{ guard: 'pending', target: 'flushing' }, { target: 'idle' }], // 즉시 flush(beforeunload 등)
      },
    },
    flushing: {
      entry: 'drain',
      // 전송 중 열람은 다음 배치로 누적(상태 유지). flushing엔 FLUSH/after가 없어 동시 flush 불가(직렬).
      on: { RECORD_VIEW: { actions: 'accumulate' } },
      invoke: {
        src: 'flush',
        input: ({ context }) => context.inFlight!,
        onDone: [
          // 전송 중 새 페어가 쌓였으면 accumulating으로(디바운스가 다음 배치를 보낸다), 아니면 idle.
          { guard: 'pending', actions: ['captureFlush', 'rotateBatch'], target: 'accumulating' },
          { actions: ['captureFlush', 'rotateBatch'], target: 'idle' },
        ],
        // 실패: 재병합 후 accumulating → 디바운스(또는 beforeunload FLUSH)가 같은 batchId로 재시도.
        onError: { actions: ['remerge', 'clearInFlight'], target: 'accumulating' },
      },
    },
  },
})

export const recallFlushActor = createActor(recallFlushMachine)
recallFlushActor.start()

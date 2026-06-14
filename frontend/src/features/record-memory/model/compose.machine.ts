import { setup, assign, emit, fromPromise, createActor, type SnapshotFrom } from 'xstate'
import { Mood } from '@/shared/api'
import { bodyLengthBucket, capture, EVENTS } from '@/shared/lib'
import {
  BODY_TOO_LONG_MSG,
  EMPTY_FRAGMENT_MSG,
  MAX_BODY_CHARS,
  MAX_FRAGMENTS,
  recordErrorMessage,
  recordMemory,
  segmentErrorMessage,
  segmentMemory,
  type DraftFragment,
} from '../api/record-memory'

// 작성 머신(features/record-memory/model) — 구 draft-store(phase×status) + use-record-memory(async
// 오케스트레이션)를 한 FSM으로. 두 단계: composing(본문) → "별로 분해"(segmenting) → reviewing(조각·감정
// 확인/수정) → "별 띄우기"(submitting). phase×status가 한 상태로 합쳐져 불가능 조합(예: review 아닌데
// submitting)이 표현 불가능하다. 본문/조각 같은 폼 데이터는 context, 분해·제출은 invoke 액터(순수 API).
//
// 순수 TS(three/React/DOM 미의존, 헌법4). 모듈 싱글턴 composeActor(구 zustand 싱글턴과 동형 — 데스크톱
// 패널·모바일 시트 두 MemoryForm이 한 드래프트를 공유). 제출 성공 시 emit('submitted') → 페이지가
// 쿼리 무효화(queryClient는 React 컨텍스트라 머신이 직접 못 잡는다 — app 레이어 import 금지).

interface Ctx {
  body: string
  entryDate: string // YYYY-MM-DD
  /** 검토 조각(AI 제안 + 사용자 편집) — reviewing/submitting에서만 의미. */
  fragments: DraftFragment[]
  /** 멱등 nonce — 이 드래프트 수명 동안 고정(실패 재제출은 같은 키로 서버 dedup). 조각 편집 시 새로
   *  굴려(수정된 재제출이 옛 커밋으로 dedup돼 증발하는 것 방지) — reset 시 다음 일기용으로 교체. */
  submitNonce: string
  errorText: string
}

type Ev =
  | { type: 'SET_BODY'; body: string }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SEGMENT' } // "별로 분해"
  | { type: 'UPDATE_FRAGMENT'; id: string; patch: Partial<Omit<DraftFragment, 'id'>> }
  | { type: 'ADD_FRAGMENT' }
  | { type: 'REMOVE_FRAGMENT'; id: string }
  | { type: 'BACK_TO_COMPOSE' }
  | { type: 'SUBMIT' } // "별 띄우기"

/** Today as YYYY-MM-DD in local time (acceptance 1.5 default). */
function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function emptyFragment(): DraftFragment {
  return { id: crypto.randomUUID(), text: '', mood: Mood.NEUTRAL, intensity: 0.5, valence: 0 }
}

/** 본문 사전 검증(17) — 분해·제출 공유. 통과 null, 실패 시 에러 카피. */
function bodyError(body: string): string | null {
  if (!body.trim()) return '일기 본문을 입력하세요'
  if ([...body].length > MAX_BODY_CHARS) return BODY_TOO_LONG_MSG // 코드포인트 = 서버 RuneCount 단위
  return null
}

/** 제출 사전 검증 — 본문 + 조각. */
function submitError(ctx: Ctx): string | null {
  const be = bodyError(ctx.body)
  if (be) return be
  if (ctx.fragments.length === 0) return '띄울 조각이 없어요 — 먼저 일기를 분해해 주세요.'
  if (ctx.fragments.some((f) => !f.text.trim())) return EMPTY_FRAGMENT_MSG
  return null
}

/** record_memory 분석 속성(18, 3.2) — 본문은 길이 버킷으로만(원문 미포함). */
function recordMetric(ctx: Ctx, success: boolean) {
  return {
    mood: 'auto',
    fragment_count: ctx.fragments.length,
    body_length_bucket: bodyLengthBucket([...ctx.body].length),
    success,
  }
}

export const composeMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
    emitted: {} as { type: 'submitted' },
  },
  actors: {
    segment: fromPromise(({ input }: { input: { body: string } }) => segmentMemory(input.body)),
    submit: fromPromise(({ input }: { input: Parameters<typeof recordMemory>[0] }) => recordMemory(input)),
  },
  guards: {
    bodyOk: ({ context }) => bodyError(context.body) === null,
    submitOk: ({ context }) => submitError(context) === null,
    canAddFragment: ({ context }) => context.fragments.length < MAX_FRAGMENTS,
  },
  actions: {
    setBody: assign({ body: ({ event }) => (event.type === 'SET_BODY' ? event.body : '') }),
    setDate: assign({ entryDate: ({ event }) => (event.type === 'SET_DATE' ? event.date : todayLocal()) }),
    clearError: assign({ errorText: '' }),
    bodyErr: assign({ errorText: ({ context }) => bodyError(context.body) ?? '' }),
    submitErr: assign({ errorText: ({ context }) => submitError(context) ?? '' }),
    // 조각 편집은 모두 nonce를 새로 굴린다(내용이 달라진 재제출이 옛 커밋으로 dedup되지 않게).
    updateFragment: assign({
      fragments: ({ context, event }) =>
        event.type === 'UPDATE_FRAGMENT'
          ? context.fragments.map((f) => (f.id === event.id ? { ...f, ...event.patch } : f))
          : context.fragments,
      submitNonce: () => crypto.randomUUID(),
    }),
    addFragment: assign({
      fragments: ({ context }) => [...context.fragments, emptyFragment()],
      submitNonce: () => crypto.randomUUID(),
    }),
    removeFragment: assign({
      fragments: ({ context, event }) =>
        event.type === 'REMOVE_FRAGMENT' ? context.fragments.filter((f) => f.id !== event.id) : context.fragments,
      submitNonce: () => crypto.randomUUID(),
    }),
    // 검토 → 본문 복귀: 조각 버림(본문이 바뀔 수 있으니 재분해가 출처).
    backToCompose: assign({ fragments: [], errorText: '' }),
    resetDraft: assign({
      body: '',
      fragments: [],
      errorText: '',
      entryDate: () => todayLocal(),
      submitNonce: () => crypto.randomUUID(),
    }),
    captureSuccess: ({ context }) => capture(EVENTS.recordMemory, recordMetric(context, true)),
    captureFail: ({ context }) => capture(EVENTS.recordMemory, recordMetric(context, false)),
  },
}).createMachine({
  id: 'compose',
  context: {
    body: '',
    entryDate: todayLocal(),
    fragments: [],
    submitNonce: crypto.randomUUID(),
    errorText: '',
  },
  initial: 'composing',
  states: {
    composing: {
      on: {
        SET_BODY: { actions: 'setBody' }, // errorText는 다음 시도까지 유지(구 status='error' 의미)
        SET_DATE: { actions: 'setDate' },
        SEGMENT: [
          { guard: 'bodyOk', target: 'segmenting' },
          { actions: 'bodyErr' }, // stay composing, show specific error
        ],
      },
    },
    segmenting: {
      entry: 'clearError', // 새 시도 시작 → 이전 에러 숨김(구 setStatus가 status를 error에서 옮기던 것)
      invoke: {
        src: 'segment',
        input: ({ context }) => ({ body: context.body }),
        onDone: { target: 'reviewing', actions: assign({ fragments: ({ event }) => event.output }) },
        onError: {
          target: 'composing',
          actions: assign({ errorText: ({ event }) => segmentErrorMessage(event.error) }),
        },
      },
    },
    reviewing: {
      on: {
        UPDATE_FRAGMENT: { actions: 'updateFragment' },
        ADD_FRAGMENT: { guard: 'canAddFragment', actions: 'addFragment' },
        REMOVE_FRAGMENT: { actions: 'removeFragment' },
        BACK_TO_COMPOSE: { target: 'composing', actions: 'backToCompose' },
        SUBMIT: [
          { guard: 'submitOk', target: 'submitting' },
          { actions: 'submitErr' }, // stay reviewing, show specific error
        ],
      },
    },
    submitting: {
      entry: 'clearError',
      invoke: {
        src: 'submit',
        input: ({ context }) => ({
          body: context.body,
          entryDate: context.entryDate,
          fragments: context.fragments,
          idempotencyKey: `rec-${context.submitNonce}`,
        }),
        // 성공: 별이 즉시 태어남(동기 fan-out). 드래프트 리셋 + 분석 + emit('submitted')으로 페이지가
        // 우주/일기목록 무효화 + 시냅스 지연 refetch를 건다(queryClient는 페이지 몫).
        // ⚠ captureSuccess가 resetDraft보다 먼저 — v5는 같은 전이의 assign 갱신이 이후 액션에 보이므로,
        // 순서를 바꾸면 metric이 비워진 context(fragment_count=0)를 읽는다(구 코드는 reset 전에 capture).
        onDone: {
          target: 'composing',
          actions: ['captureSuccess', 'resetDraft', emit({ type: 'submitted' })],
        },
        // 실패: 서버 검증 메시지로 표면화(2.8). nonce 유지(순수 재시도 = 같은 키 → 서버 dedup).
        onError: {
          target: 'reviewing',
          actions: [assign({ errorText: ({ event }) => recordErrorMessage(event.error) }), 'captureFail'],
        },
      },
    },
  },
})

// 모듈 싱글턴(구 useDraftStore와 동형 수명) — 두 MemoryForm 인스턴스가 한 드래프트를 공유.
export const composeActor = createActor(composeMachine)
composeActor.start()

type Snap = SnapshotFrom<typeof composeMachine>

// 파생 selector(컴포넌트 밖 정의). MemoryForm이 useSelector로 구독.
export const selectPhase = (s: Snap): 'compose' | 'review' =>
  s.matches('reviewing') || s.matches('submitting') ? 'review' : 'compose'
export const selectBody = (s: Snap): string => s.context.body
export const selectEntryDate = (s: Snap): string => s.context.entryDate
export const selectFragments = (s: Snap): DraftFragment[] => s.context.fragments
export const selectErrorText = (s: Snap): string => s.context.errorText
export const selectIsSegmenting = (s: Snap): boolean => s.matches('segmenting')
export const selectIsSubmitting = (s: Snap): boolean => s.matches('submitting')

import { setup, assign, createActor, type SnapshotFrom } from 'xstate'

// 포커스 머신(entities/memory/model) — "지금 무엇에 집중하나"의 단일 출처. 구 memory.selectedId +
// wayfinding.highlightedRecordId/frameRequest를 흡수한다. 별 포커스와 일기 조망은 한 머신의 배타
// 상태라 동시에 켜질 수 없다(구 NearFarHighlightGuard의 "선택 시 강조 해제"가 구조가 됨).
//
// 배치 근거(FSD): 포커스는 widgets/universe-canvas(카메라 컨트롤러)와 features/recall·diary-list가
// 모두 단방향으로 읽어야 한다 — 둘의 공통 하위 레이어는 entities뿐이고, selectedId가 원래
// entities/memory에 살았다. 순수 TS(three/React/DOM 미의존, 헌법4) — React는 ui가 useSelector로,
// 카메라 컨트롤러는 getSnapshot으로 읽고, resetUniverseData(app)는 모듈 싱글턴 focusActor에 DISMISS를
// 보낸다(구 zustand 싱글턴과 동형 수명).

interface Ctx {
  /** 선택된 별 id(star 상태에서만 유효). */
  starId: string | null
  /** 조망 중인 원본 일기 record_id(diary 상태에서만 유효). */
  recordId: string | null
  /** 단조 증가 — 같은 일기를 다시 골라도 frame-all 비행이 재발화하도록(구 frameRequest.nonce 대체).
   *  카메라 FrameAll 컨트롤러가 마지막으로 처리한 값과 비교해 새 요청만 소비한다. */
  frameNonce: number
  /** 겹쳐보기(spec 37) 공명 쌍 선택(pair 상태에서만 유효): 내 별 id + 상대 별 id(각 우주의 별 id —
   *  공개 방문은 상대를 `shared-N`으로, 데모는 페르소나 별 id로 푼다). 단일 starId와 배타 — 한 번에
   *  하나만(비교 패널·다리 강조의 단일 출처). */
  pairMyId: string | null
  pairTheirId: string | null
}

type Ev =
  | { type: 'SELECT_STAR'; id: string } // 별 클릭 / fly-to 도착 → 회상 패널
  | { type: 'SELECT_DIARY'; recordId: string } // 일기 목록에서 고름
  | { type: 'SEE_DIARY_STARS'; recordId: string } // 회상 패널 "이 일기의 다른 별들" — SELECT_DIARY와 동일 동작
  | { type: 'SELECT_PAIR'; myId: string; theirId: string } // 겹쳐보기 다리 선택(spec 37) → 비교 패널
  | { type: 'DISMISS' } // 빈 곳 탭 / Esc / 출처 경계 리셋 → 복귀

export const focusMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev },
  actions: {
    toStar: assign({
      starId: ({ event }) => (event.type === 'SELECT_STAR' ? event.id : null),
      recordId: null,
      pairMyId: null,
      pairTheirId: null,
    }),
    // SELECT_DIARY·SEE_DIARY_STARS 둘 다 이 액션 → 두 진입점이 구조적으로 동일(불일치 해소).
    toDiary: assign({
      recordId: ({ event }) =>
        event.type === 'SELECT_DIARY' || event.type === 'SEE_DIARY_STARS' ? event.recordId : null,
      starId: null,
      pairMyId: null,
      pairTheirId: null,
      frameNonce: ({ context }) => context.frameNonce + 1,
    }),
    // 겹쳐보기 쌍 선택(spec 37) — 단일 star/diary 선택을 비운다(배타).
    toPair: assign({
      pairMyId: ({ event }) => (event.type === 'SELECT_PAIR' ? event.myId : null),
      pairTheirId: ({ event }) => (event.type === 'SELECT_PAIR' ? event.theirId : null),
      starId: null,
      recordId: null,
    }),
    clear: assign({ starId: null, recordId: null, pairMyId: null, pairTheirId: null }),
  },
}).createMachine({
  id: 'focus',
  context: { starId: null, recordId: null, frameNonce: 0, pairMyId: null, pairTheirId: null },
  initial: 'idle',
  // 루트 전이 — 어느 상태에서든 받는다(star↔diary↔pair↔idle 자유 전환). 배타는 단일 활성 상태로 보장.
  on: {
    SELECT_STAR: { target: '.star', actions: 'toStar' },
    SELECT_DIARY: { target: '.diary', actions: 'toDiary' },
    SEE_DIARY_STARS: { target: '.diary', actions: 'toDiary' },
    SELECT_PAIR: { target: '.pair', actions: 'toPair' },
    DISMISS: { target: '.idle', actions: 'clear' },
  },
  states: { idle: {}, star: {}, diary: {}, pair: {} },
})

// 앱 전역 단일 우주 → 모듈 싱글턴 액터(구 zustand 스토어와 동일 수명). resetUniverseData가 import해
// DISMISS를 보낼 수 있고, 카메라 컨트롤러가 getSnapshot으로 매 프레임 읽는다.
export const focusActor = createActor(focusMachine)
focusActor.start()

type Snap = SnapshotFrom<typeof focusMachine>

// 파생 selector(컴포넌트 밖 정의 — 참조 안정). 구 selectedId/highlightedRecordId의 대체.
export const selectFocusedStarId = (s: Snap): string | null => (s.matches('star') ? s.context.starId : null)
export const selectHighlightedRecordId = (s: Snap): string | null =>
  s.matches('diary') ? s.context.recordId : null
export const selectIsStarFocus = (s: Snap): boolean => s.matches('star')
export const selectIsDiaryFocus = (s: Snap): boolean => s.matches('diary')
export const selectIsFocused = (s: Snap): boolean => s.matches('star') || s.matches('diary')
export const selectFrameNonce = (s: Snap): number => s.context.frameNonce
// 겹쳐보기 쌍 포커스(spec 37). 비교 패널·다리 강조의 단일 출처.
export const selectIsPairFocus = (s: Snap): boolean => s.matches('pair')
export const selectPairFocus = (s: Snap): { myId: string; theirId: string } | null =>
  s.matches('pair') && s.context.pairMyId != null && s.context.pairTheirId != null
    ? { myId: s.context.pairMyId, theirId: s.context.pairTheirId }
    : null

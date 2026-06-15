import { setup, assign, createActor, type SnapshotFrom } from 'xstate'
import type { CameraMode } from '@/shared/lib/r3f'
import { setOverlayWriteBlocked } from '@/shared/lib'

// 항행(카메라) 머신(widgets/universe-canvas/model) — 구 use-camera-mode(zustand) + UniverseCanvas의
// 비행 컨트롤러들(FlyTo·FrameAll·ModeTransition)의 흩어진 플래그를 하나의 명시적 FSM으로. 우주를
// 항해하는 "게임"의 카메라 상태기다. 순수 TS(three/React/DOM 미의존, 헌법4) — 카메라 컨트롤러는
// 매 프레임 getSnapshot으로 읽고(React 리렌더 없이 60fps 구동 금지 — Architecture §3.2), 도착 시
// ARRIVED를 보낸다. 연속 보간(lerp)은 컨트롤러 useFrame에 남고, 머신은 이산 상태·타깃만 든다.
//
// 상태:
//  - nebula        조망 궤도(자유 관찰) — settled
//  - recall        근접 비행(우주선, D-pad) — settled
//  - flyingToStar  특정 별로 fly-to(잠든 별 선택) — #transitioning → ARRIVED → recall
//  - framingDiary  일기의 모든 별 조망(frame-all) — #transitioning → ARRIVED → nebula
//  - modeTransition 토글 시 모드 시그니처 포즈로 비행 — #transitioning → ARRIVED → transitionTo
// #transitioning 태그가 켜진 동안 CameraRig가 거리/함선 경계 클램프를 완화한다.
//
// move(D-pad 입력)는 press/release 이산 이벤트(SET_MOVE)로 context에 둔다 — NavController가 매
// 프레임 getSnapshot으로 읽는다(60fps 이벤트 아님). 좌표 lerp 같은 연속값은 머신 밖(컨트롤러 ref).

interface Move {
  x: number
  y: number
  z: number
}

interface Ctx {
  /** flyingToStar 목표 별 id. */
  flyStarId: string | null
  /** framingDiary 대상 원본 일기 record_id. */
  frameRecordId: string | null
  /** framingDiary 재발화 카운터(같은 일기 재조망도 다시 프레이밍 — FrameAll 컨트롤러가 비교). */
  frameSeq: number
  /** modeTransition 도착 모드. */
  transitionTo: CameraMode
  /** recall 항해 입력(D-pad): x=yaw, y=pitch, z=thrust. press/release로만 변한다. */
  move: Move
  /** 겹쳐보기(spec 37) framingPair 대상: 내 별 id + 상대 별 id(각 우주의 별 id). 오버레이의
   *  쌍-프레이밍 컨트롤러가 양 우주 버퍼에서 두 끝점을 풀어 한 프레임에 담는다. */
  pairMyId: string | null
  pairTheirId: string | null
  /** framingPair 재발화 카운터(같은 다리를 다시 눌러도 재프레이밍 — frameSeq와 동형). */
  pairSeq: number
  /** 겹쳐보기 진입 직전 모드 — EXIT_OVERLAY가 nebula로 일괄 복귀하지 않고 떠나온 모드(nebula/recall)로
   *  되돌리기 위해 ENTER_OVERLAY 시 기록한다(비행 중 진입은 그 비행의 자연 도착 모드를 쓴다). */
  overlayReturn: CameraMode
}

type Ev =
  | { type: 'TOGGLE_MODE' } // 카메라 토글 버튼 → 반대 모드로 비행
  | { type: 'FLY_TO_STAR'; id: string } // 잠든 별 선택 → 그 별로 fly-to
  | { type: 'FRAME_DIARY'; recordId: string } // 포커스가 일기로 진입 → 조망(focus→nav 브리지)
  | { type: 'ARRIVED' } // 비행 컨트롤러가 도착 시 송신
  | { type: 'SET_MOVE'; move: Partial<Move> } // D-pad 입력(부분 병합)
  | { type: 'ENTER_OVERLAY' } // 겹쳐보기 켜기(spec 37) → overlay 상태(nebula/recall과 배타·쓰기 게이트)
  | { type: 'EXIT_OVERLAY' } // 겹쳐보기 끄기 → nebula 복귀(친구 우주만 보는 원래 화면)
  | { type: 'FRAME_PAIR'; myId: string; theirId: string } // 공명 다리 클릭/근접 → 두 별 동시 프레이밍

const NO_MOVE: Move = { x: 0, y: 0, z: 0 }

// 비행 안전 타임아웃 — flyingToStar/framingDiary는 컨트롤러가 타깃(별/일기 좌표)을 못 풀면(우주 미로드·
// GetUniverse 실패·id 부재) ARRIVED를 못 보내 transitioning에 영영 갇힌다(클램프 완화·카메라 동결). 정상
// 비행은 ~수초 내 도착하므로, 이 시간이 지나도 안 끝나면 강제로 settled로 빠져나간다(카메라 동결 방지).
const FLIGHT_TIMEOUT_MS = 10_000

export const navigationMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev },
  actions: {
    setFly: assign({ flyStarId: ({ event }) => (event.type === 'FLY_TO_STAR' ? event.id : null) }),
    setFrame: assign({
      frameRecordId: ({ event }) => (event.type === 'FRAME_DIARY' ? event.recordId : null),
      frameSeq: ({ context }) => context.frameSeq + 1,
    }),
    toRecall: assign({ transitionTo: 'recall' as CameraMode, move: { ...NO_MOVE } }),
    toNebula: assign({ transitionTo: 'nebula' as CameraMode, move: { ...NO_MOVE } }),
    // recall을 떠나면 눌려 있던 이동을 0으로(모드가 D-pad 밑에서 빠져 pointerup을 잃어도 안 멈춤 방지).
    stopMove: assign({ move: { ...NO_MOVE } }),
    applyMove: assign({ move: ({ context, event }) => (event.type === 'SET_MOVE' ? { ...context.move, ...event.move } : context.move) }),
    // 겹쳐보기(spec 37): 다리 프레이밍 대상을 잡고 재발화 카운터를 올린다(frameSeq와 동형).
    setPair: assign({
      pairMyId: ({ event }) => (event.type === 'FRAME_PAIR' ? event.myId : null),
      pairTheirId: ({ event }) => (event.type === 'FRAME_PAIR' ? event.theirId : null),
      pairSeq: ({ context }) => context.pairSeq + 1,
    }),
    clearPair: assign({ pairMyId: null, pairTheirId: null, move: { ...NO_MOVE } }),
    // 겹쳐보기 진입: 복귀 모드를 기록하고(어느 상태에서 들어왔는지) 쌍/이동을 비운다. 비행(transitioning)
    // 중 진입은 그 비행의 자연 도착 모드(fly-to→recall, frame-diary→nebula, mode→transitionTo)를 복귀로 쓴다.
    enterFromNebula: assign({ overlayReturn: 'nebula' as CameraMode, pairMyId: null, pairTheirId: null, move: { ...NO_MOVE } }),
    enterFromRecall: assign({ overlayReturn: 'recall' as CameraMode, pairMyId: null, pairTheirId: null, move: { ...NO_MOVE } }),
    enterFromTransition: assign({
      overlayReturn: ({ context }) => context.transitionTo,
      pairMyId: null,
      pairTheirId: null,
      move: { ...NO_MOVE },
    }),
    // overlay는 쓰기 RPC 0건(3.1) — 진입/이탈에 shared 쓰기 게이트를 켜고/끈다(쓰기 경로가 읽어 막는다).
    blockWrites: () => setOverlayWriteBlocked(true),
    unblockWrites: () => setOverlayWriteBlocked(false),
  },
}).createMachine({
  id: 'navigation',
  context: {
    flyStarId: null,
    frameRecordId: null,
    frameSeq: 0,
    transitionTo: 'nebula',
    move: { ...NO_MOVE },
    pairMyId: null,
    pairTheirId: null,
    pairSeq: 0,
    overlayReturn: 'nebula',
  },
  initial: 'nebula',
  // SET_MOVE는 어느 상태에서든 받아 context.move만 갱신(상태 전이 없음 — 비활성 상태에선 컨트롤러가 무시).
  on: { SET_MOVE: { actions: 'applyMove' } },
  states: {
    nebula: {
      on: {
        TOGGLE_MODE: { target: 'modeTransition', actions: 'toRecall' },
        FLY_TO_STAR: { target: 'flyingToStar', actions: 'setFly' },
        FRAME_DIARY: { target: 'framingDiary', actions: 'setFrame' },
        ENTER_OVERLAY: { target: 'overlay', actions: 'enterFromNebula' },
      },
    },
    recall: {
      on: {
        TOGGLE_MODE: { target: 'modeTransition', actions: 'toNebula' },
        FLY_TO_STAR: { target: 'flyingToStar', actions: 'setFly' },
        FRAME_DIARY: { target: 'framingDiary', actions: 'setFrame' },
        ENTER_OVERLAY: { target: 'overlay', actions: 'enterFromRecall' },
      },
    },
    flyingToStar: {
      tags: 'transitioning',
      // 타깃 미해결로 ARRIVED가 영영 안 오는 경우의 안전망(동결 방지) — 정상 비행은 훨씬 빨리 도착해 이탈.
      after: { [FLIGHT_TIMEOUT_MS]: 'recall' },
      on: {
        // 근접 안착. stopMove로 끊지 않는다 — fly-to 동안 NavPad가 떠 있어(selectHeadingMode→recall)
        // 눌려 있던 D-pad가 도착 후에도 이어진다(연속 제어). 멈춤이 필요한 "recall 떠나기"는 toNebula가 처리.
        ARRIVED: 'recall',
        FLY_TO_STAR: { target: 'flyingToStar', actions: 'setFly', reenter: true }, // 다른 별 재지정
        FRAME_DIARY: { target: 'framingDiary', actions: 'setFrame' },
        // 비행 중 겹쳐보기 토글 — 흘리지 않고 overlay로 전환한다(fly-to는 recall로 끝나므로 복귀도 recall).
        ENTER_OVERLAY: { target: 'overlay', actions: 'enterFromRecall' },
      },
    },
    framingDiary: {
      tags: 'transitioning',
      after: { [FLIGHT_TIMEOUT_MS]: 'nebula' }, // 안전망(동결 방지)
      on: {
        ARRIVED: 'nebula', // 조망은 far(nebula)에서 끝난다
        FRAME_DIARY: { target: 'framingDiary', actions: 'setFrame', reenter: true }, // 같은/다른 일기 재조망
        FLY_TO_STAR: { target: 'flyingToStar', actions: 'setFly' },
        // 조망 비행 중 겹쳐보기 토글 — 조망은 nebula로 끝나므로 복귀도 nebula.
        ENTER_OVERLAY: { target: 'overlay', actions: 'enterFromNebula' },
      },
    },
    modeTransition: {
      tags: 'transitioning',
      // ModeTransitionController는 항상 포즈를 arm하므로 자체 타임아웃 불요. 단 비행 중 fly-to/조망 요청은
      // 흘리지 않고 해당 비행으로 전환한다(예: 토글 비행 중 "이 일기의 다른 별들" → 조망). 컨트롤러는
      // nav 상태 가드로 양보.
      on: {
        ARRIVED: [
          { guard: ({ context }) => context.transitionTo === 'recall', target: 'recall' },
          { target: 'nebula', actions: 'stopMove' },
        ],
        FLY_TO_STAR: { target: 'flyingToStar', actions: 'setFly' },
        FRAME_DIARY: { target: 'framingDiary', actions: 'setFrame' },
        // 모드 전환 비행 중 겹쳐보기 토글 — 향하던 모드(transitionTo)를 복귀 모드로.
        ENTER_OVERLAY: { target: 'overlay', actions: 'enterFromTransition' },
      },
    },
    // 겹쳐보기(spec 37) — 두 우주를 한 씬에 띄우는 순수 뷰 상태(nebula/recall과 배타). 이 상태에선
    // 회상 강화 등 쓰기 RPC가 게이트로 막힌다(boolean 플래그가 아니라 상태로 단순화 — 설계 요점).
    // 단일 우주 카메라 컨트롤러(UniverseCanvas)는 오버레이가 뜨면 언마운트되고, 오버레이 위젯의 전용
    // 컨트롤러가 viewing/framingPair를 읽어 카메라를 몬다.
    overlay: {
      initial: 'viewing',
      // 진입/이탈에 쓰기 게이트를 켜고/끈다(3.1 — overlay에선 쓰기 RPC 0건). 부모 entry/exit는
      // viewing↔framingPair 내부 전이엔 재실행되지 않고 overlay 경계를 넘을 때만 발화한다.
      entry: 'blockWrites',
      exit: 'unblockWrites',
      // 이탈은 떠나온 모드로 복귀한다(recall에서 켰으면 recall로, 아니면 nebula) — 항해 모드 유실 방지.
      on: {
        EXIT_OVERLAY: [
          { guard: ({ context }) => context.overlayReturn === 'recall', target: 'recall', actions: 'clearPair' },
          { target: 'nebula', actions: 'clearPair' },
        ],
      },
      states: {
        viewing: {
          on: { FRAME_PAIR: { target: 'framingPair', actions: 'setPair' } },
        },
        framingPair: {
          tags: 'transitioning',
          after: { [FLIGHT_TIMEOUT_MS]: 'viewing' }, // 타깃 미해결 안전망(동결 방지 — 다른 비행과 동일)
          on: {
            ARRIVED: 'viewing',
            FRAME_PAIR: { target: 'framingPair', actions: 'setPair', reenter: true }, // 같은/다른 다리 재프레이밍
          },
        },
      },
    },
  },
})

// 앱 전역 단일 카메라 → 모듈 싱글턴 액터(구 use-camera-mode zustand와 동일 수명). 컨트롤러가
// getSnapshot으로 매 프레임 읽고 send로 전이한다.
export const navigationActor = createActor(navigationMachine)
navigationActor.start()

type Snap = SnapshotFrom<typeof navigationMachine>

// 파생 selector(컴포넌트 밖 정의). settled nebula/recall은 transitioning 태그가 없으므로 그 자체로
// "비전환"을 함의한다.
export const selectIsNebula = (s: Snap): boolean => s.matches('nebula')
export const selectIsRecall = (s: Snap): boolean => s.matches('recall')
export const selectTransitioning = (s: Snap): boolean => s.hasTag('transitioning')
export const selectFlyStarId = (s: Snap): string | null => (s.matches('flyingToStar') ? s.context.flyStarId : null)
export const selectFrameRecordId = (s: Snap): string | null => (s.matches('framingDiary') ? s.context.frameRecordId : null)
export const selectFrameSeq = (s: Snap): number => s.context.frameSeq
export const selectInModeTransition = (s: Snap): boolean => s.matches('modeTransition')
export const selectTransitionTo = (s: Snap): CameraMode => s.context.transitionTo
// 겹쳐보기(spec 37). overlay 부모 매치는 viewing·framingPair 둘 다 true(오버레이 위젯 마운트 게이트).
export const selectIsOverlay = (s: Snap): boolean => s.matches('overlay')
export const selectIsFramingPair = (s: Snap): boolean => s.matches({ overlay: 'framingPair' })
/** framingPair 대상(내 별 id + 상대 별 인덱스) + 재발화 seq — 오버레이 쌍-프레이밍 컨트롤러가
 *  새 요청만 소비한다(같은 다리 재클릭도 seq로 구분). framingPair가 아니면 null. */
export const selectFramingPair = (
  s: Snap,
): { myId: string; theirId: string; seq: number } | null =>
  s.matches({ overlay: 'framingPair' }) && s.context.pairMyId != null && s.context.pairTheirId != null
    ? { myId: s.context.pairMyId, theirId: s.context.pairTheirId, seq: s.context.pairSeq }
    : null
/** HUD 라벨/NavPad 가시성용 "현재 또는 향하는" 모드 — 비행 중엔 도착 모드를 보여준다. */
export const selectHeadingMode = (s: Snap): CameraMode => {
  if (s.matches('recall') || s.matches('flyingToStar')) return 'recall'
  if (s.matches('modeTransition')) return s.context.transitionTo
  return 'nebula' // nebula, framingDiary
}

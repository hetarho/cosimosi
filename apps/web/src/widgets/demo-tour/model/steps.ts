// 첫 별 튜토리얼 스포트라이트 투어의 단계 정의(plan 48·change 34). 순수 데이터 — React/DOM/three를
// import하지 않는다(헌법 §4·§8). 데모 우주와 실계정 최초 진입이 **같은 튜토리얼 언어**를 공유하되, 단계마다
// `contexts`로 어디서 보일지 가른다(실계정엔 데모 페르소나/시간 단계가 안 나온다, A16).
//
// 흐름은 "빈 우주 → 첫 별을 띄우고 → 그 별을 눌러 기억을 읽고 → 조작법을 배운다" 순서다(change §7). 각
// phase는 `kind`로 행동/정보를 명시한다: **행동(action)** phase는 사용자가 버튼/별을 눌러야(await) 진행되고
// `다음`이 없다, **정보(info)** phase는 설명만 읽고 `다음`으로 진행한다(A15 — 이 구분이 머신 상태가 된다).
// DOM 측정·렌더·카메라 lock 같은 부수효과는 ui/pages가 맡는다(모델은 이름만 안다).

/** 단계가 보일 맥락 — demo는 체험 우주, account는 실계정 최초 빈 우주. 둘 다면 공통(A16). */
export type TourContext = 'demo' | 'account'

/** phase 종류(A15) — action: 눌러야 진행(다음 없음), info: 설명·`다음`으로 진행. */
export type TourKind = 'action' | 'info'

/** 하이라이트 대상의 안정 식별자. 대부분 DOM `data-tour-id`(HUD·시트·폼·패널)이고, `canvas-star`는 3D
 *  캔버스 안 생성/fixture 별이라 DOM rect가 없다 → 페이지가 화면 rect를 투영해 준다(A7·A8). */
export type TourTargetId =
  | 'ui-toggle'
  | 'theme'
  | 'persona'
  | 'persona-popover'
  | 'time'
  | 'time-speed'
  | 'view'
  | 'telescope'
  | 'new-star'
  | 'compose-form'
  | 'compose-body'
  | 'review-panel'
  | 'submit-stars'
  | 'segment'
  | 'explorer-diary-tab'
  | 'explorer-star-tab'
  | 'explorer-diary-panel'
  | 'explorer-star-panel'
  | 'recall-panel'
  | 'canvas-star'

/** 페이지가 이 단계 진입에 맞춰 둘 표면 상태. 'none'=모든 표면 닫고 포커스 해제, 'compose'=작성 폼 유지
 *  (사용자가 새 별로 열어 둔 것), 'recall'=별 회상 포커스 유지(사용자가 별을 눌러 연 것). 망원경은 단계
 *  진입 시 닫고('none') 사용자가 버튼으로 다시 연다(행동 안내). */
export type TourSurface = 'none' | 'compose' | 'recall'

/** 이 phase를 완료(다음 phase로)하기 위한 사용자 행동 신호. info phase는 null(=`다음`).
 *  '*-changed'/'*-moved'/'submitted'는 phase 진입 시점 기준 변화를 관찰한다(persona·clock·제출).
 *  'compose-open'/'segmented'/'recall-open'/'explorer-*'는 작성·회상·탐색 표면의 이산 상태를 관찰한다.
 *  'nebula-*'/'recall-looked'·'recall-thrusted'(change 12)는 항해 실습 — ui가 rAF로 샘플링한다. */
export type TourAwait =
  | 'ui-hidden'
  | 'ui-shown'
  | 'persona-open'
  | 'persona-changed'
  | 'time-open'
  | 'time-moved'
  | 'explorer-open'
  | 'compose-open'
  | 'segmented'
  | 'submitted'
  | 'recall-open'
  | 'explorer-star-selected'
  | 'nebula-rotated'
  | 'nebula-zoomed'
  | 'recall-looked'
  | 'recall-thrusted'
  | null

/** 항해 실습 phase가 기대하는 카메라 모드(change 12). 페이지가 phase 진입 시 nav를 이 모드로 맞춘다. */
export type TourCameraMode = 'nebula' | 'recall'

/** 디바이스 분기 문구(change 12) — 비터치(웹)는 mouse, 터치(모바일)는 touch. 단일 string이면 공용. */
export type TourBody = string | { mouse: string; touch: string }

export interface TourPhase {
  /** 하이라이트 대상. null이면 중앙 안내 카드만(주변 딤은 클릭을 막지 않는다). */
  target: TourTargetId | null
  /** phase 종류 — action/info. `다음` 노출·진행 방식을 가른다(A15). */
  kind: TourKind
  /** 짧은 안내 문구(디바이스 분기 가능). */
  body: TourBody
  /** action phase의 완료 신호(이 행동이 일어나면 다음 phase로). info phase는 null. */
  await: TourAwait
  /** 항해 실습 phase가 기대하는 카메라 모드(change 12). 없으면 모드 미관여. */
  mode?: TourCameraMode
}

export interface TourStep {
  id: string
  title: string
  /** 이 단계가 보일 맥락(A16) — demo 전용/account 전용/공통. */
  contexts: TourContext[]
  /** 페이지가 이 단계 진입에 맞춰 둘 표면 상태. */
  surface: TourSurface
  /** 첫 별 클릭/회상 설명 전까지 카메라 조작을 잠근다(A9·A12). 이 플래그가 true인 단계 동안 lock 유지. */
  lockCamera: boolean
  phases: TourPhase[]
}

/** 첫 별 튜토리얼 단계(change §7) — 빈 우주 → 첫 별 → 별 클릭/회상 → 망원경 → 조작법 → 부수 기능. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'empty-intro',
    title: '첫 별을 띄워볼까요?',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: true,
    phases: [
      {
        target: 'new-star',
        kind: 'action',
        await: 'compose-open',
        body: '지금 우주가 비어 있어요. 일기를 써서 첫 별을 띄워볼까요? 아래 새 별 띄우기를 눌러보세요.',
      },
    ],
  },
  {
    id: 'compose',
    title: '하루를 적고 별로 나눠요',
    contexts: ['demo', 'account'],
    surface: 'compose', // 사용자가 새 별로 연 작성 폼을 유지한다(닫지 않음)
    lockCamera: true,
    phases: [
      {
        target: 'compose-body',
        kind: 'info',
        await: null,
        body: '여기에 오늘 하루를 적어요. 어떤 하루였는지 떠오르는 대로 적으면 돼요.',
      },
      {
        target: 'segment',
        kind: 'action',
        await: 'segmented',
        body: '하루는 한 감정이 아니에요. 별 나누기를 누르면 사건 조각마다 별이 나뉘어 태어나고, 비슷한 감정의 기억끼리는 더 굵게 이어져요.',
      },
      {
        target: 'review-panel',
        kind: 'info',
        await: null,
        body: '조각마다 감정과 강도를 다듬을 수 있어요. 마음에 들면 다음으로 가요.',
      },
      {
        target: 'submit-stars',
        kind: 'action',
        await: 'submitted',
        body: '이제 별 띄우기를 눌러 첫 별을 하늘에 올려보세요.',
      },
    ],
  },
  {
    id: 'generated-star',
    title: '방금 태어난 별',
    contexts: ['demo', 'account'],
    surface: 'none', // 작성 폼은 닫고 별을 드러낸다
    lockCamera: true,
    phases: [
      {
        target: 'canvas-star',
        kind: 'action',
        await: 'recall-open',
        body: '방금 당신의 첫 별이 태어났어요. 별을 눌러 그 안의 기억을 펼쳐볼까요?',
      },
    ],
  },
  {
    id: 'recall-panel',
    title: '별을 눌러 기억을 읽어요',
    contexts: ['demo', 'account'],
    surface: 'recall', // 별을 눌러 연 회상 패널을 유지한다
    lockCamera: true,
    phases: [
      {
        target: 'recall-panel',
        kind: 'info',
        await: null,
        body: '별을 누르면 회상 패널이 열려요. 위에는 별의 모습, 아래엔 날짜·기분·강도·추상화가 있고, 조각과 원본 일기를 펼쳐 볼 수 있어요.',
      },
      {
        target: 'recall-panel',
        kind: 'info',
        await: null,
        body: '떠올릴 때마다 기억이 다시 빚어져(재공고화) 별의 형태와 빛이 달라지고, 오래 멀어진 별일수록 단순해져요. 별의 색과 형태는 나중에 감정별로 다듬을 수 있어요.',
      },
    ],
  },
  {
    id: 'telescope',
    title: '망원경 — 일기와 별 찾기',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: false, // 회상 설명이 끝났으니 여기서부터 카메라 조작이 풀린다(A12)
    phases: [
      { target: 'telescope', kind: 'action', await: 'explorer-open', body: '우주 안의 일기와 별을 찾는 입구예요. 눌러볼까요?' },
      {
        target: 'explorer-diary-panel',
        kind: 'info',
        await: null,
        body: '여긴 원본 일기를 찾는 곳이에요 — 일기를 검색하고, 그 일기에서 태어난 별들도 함께 볼 수 있어요.',
      },
      {
        target: 'explorer-star-tab',
        kind: 'action',
        await: 'explorer-star-selected',
        body: '이번엔 별 탭이에요. 눌러서 별 목록으로 넘어가 볼까요?',
      },
      {
        target: 'explorer-star-panel',
        kind: 'info',
        await: null,
        body: '별 탭에선 깨어 있는 별과 잠든 별을 한자리에서 찾아볼 수 있어요.',
      },
    ],
  },
  {
    id: 'view',
    title: '시점 전환과 항해',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: false,
    phases: [
      {
        target: 'view',
        kind: 'info',
        await: null,
        mode: 'nebula',
        body: '멀리서 우주를 조망하거나, 별들 가까이서 탐험하는 시점을 오갈 수 있어요. 직접 움직여볼까요?',
      },
      {
        target: null,
        kind: 'action',
        mode: 'nebula',
        await: 'nebula-rotated',
        body: {
          mouse: '먼저 멀리서 봐요. 마우스로 우주를 잡고 끌어 돌려보세요.',
          touch: '먼저 멀리서 봐요. 한 손가락으로 우주를 쓸어 돌려보세요.',
        },
      },
      {
        target: null,
        kind: 'action',
        mode: 'nebula',
        await: 'nebula-zoomed',
        body: {
          mouse: '이번엔 마우스 휠을 굴려 우주를 가까이 당겨보세요.',
          touch: '이번엔 두 손가락을 오므렸다 펴서 우주를 당겨보세요.',
        },
      },
      {
        target: null,
        kind: 'info',
        mode: 'recall',
        await: null,
        body: '이제 별들 사이로 들어가 볼까요? 시점을 가까이서로 바꿨어요. 빛을 든 내가 별 사이에 섰어요.',
      },
      {
        target: null,
        kind: 'action',
        mode: 'recall',
        await: 'recall-looked',
        body: {
          mouse: '마우스로 드래그해 주위를 둘러보세요.',
          touch: '한 손가락으로 드래그해 주위를 둘러보세요.',
        },
      },
      {
        target: null,
        kind: 'action',
        mode: 'recall',
        await: 'recall-thrusted',
        body: {
          mouse: '앞으로 나아가 볼까요? 화면의 전진 버튼을 누르거나 W·↑ 키로 별 쪽으로 다가가요.',
          touch: '두 손가락을 위로 쓸어 별 쪽으로 다가가 보세요.',
        },
      },
      {
        target: null,
        kind: 'info',
        mode: 'recall',
        await: null,
        body: '좋아요! 이렇게 두 시점을 오가며 별 사이를 누벼요. 다음으로 가요.',
      },
    ],
  },
  {
    id: 'theme',
    title: '테마',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: false,
    phases: [{ target: 'theme', kind: 'info', await: null, body: '스킨과 감정 색으로 우주의 분위기를 바꾸는 곳이에요.' }],
  },
  {
    id: 'persona',
    title: '페르소나',
    contexts: ['demo'], // 데모 전용 — 실계정엔 페르소나 전환이 없다(A16)
    surface: 'none',
    lockCamera: false,
    phases: [
      { target: 'persona', kind: 'action', await: 'persona-open', body: '이 버튼을 눌러볼까요?' },
      { target: 'persona-popover', kind: 'action', await: 'persona-changed', body: '다른 사람의 우주로 바꿀 수 있어요. 하나 골라보세요.' },
      {
        target: null,
        kind: 'info',
        body: '저마다 뇌가 다르듯, 우리의 기억도 다르게 빚어져요. 같은 하루도 누군가의 우주에선 전혀 다른 별이 되죠. 다음으로 넘어가요.',
        await: null,
      },
    ],
  },
  {
    id: 'time',
    title: '시간',
    contexts: ['demo'], // 데모 전용 — 실계정엔 가상 시계가 없다(A16)
    surface: 'none',
    lockCamera: false,
    phases: [
      { target: 'time', kind: 'action', await: 'time-open', body: '이번엔 시간 버튼이에요. 눌러볼까요?' },
      {
        target: 'time-speed',
        kind: 'info',
        await: null,
        body: '여기서 배속을 올려 시간을 흘려보세요. 오래 떠올리지 않은 별은 점점 멀어지고 어두워져요 — 거리가 곧 강함이라, 자주 함께 떠올린 별일수록 가까이 머물러요.',
      },
      {
        target: 'time-speed',
        kind: 'info',
        await: null,
        body: '밤이 오면 우주가 스스로 정리돼요 — 약한 연결은 빛을 낮추고, 멀어진 별은 형태가 한 단계씩 단순해져요.',
      },
    ],
  },
  {
    id: 'ui-toggle',
    title: 'UI 숨기기',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: false,
    phases: [
      { target: 'ui-toggle', kind: 'action', await: 'ui-hidden', body: '이 버튼으로 화면의 버튼들을 잠시 숨길 수 있어요 — 한번 눌러볼까요?' },
      { target: 'ui-toggle', kind: 'action', await: 'ui-shown', body: '우주만 남았죠. 다시 누르면 버튼들이 돌아와요. 눌러보세요.' },
      { target: 'ui-toggle', kind: 'info', await: null, body: '잘했어요! 우주만 보고 싶을 때 이렇게 접어둘 수 있어요.' },
    ],
  },
  {
    id: 'end',
    title: '이제 자유롭게 탐험해볼까요?',
    contexts: ['demo', 'account'],
    surface: 'none',
    lockCamera: false,
    phases: [
      { target: null, kind: 'info', await: null, body: '둘러보기는 여기까지예요. 마음껏 별을 띄우고, 떠올리고, 우주를 누벼보세요.' },
    ],
  },
]

/** 활성 맥락(demo/account)에서 보이는 단계만 추린 목록 — 머신·UI가 이 필터된 목록을 커서로 쓴다(A16). */
export function activeSteps(context: TourContext): TourStep[] {
  return TOUR_STEPS.filter((s) => s.contexts.includes(context))
}

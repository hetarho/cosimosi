// 데모 튜토리얼 스포트라이트 투어의 단계 정의(plan 48). 순수 데이터 — React/DOM/three를
// import하지 않는다(헌법 §4·§8). 각 단계는 하나 이상의 phase로 나뉘고, phase는 하이라이트할
// target(`data-tour-id`)·문구·완료 신호(await)만 담는다. 행동 안내형: 사용자가 실제로 버튼을
// 눌러 진행한다(버튼을 먼저 짚고, 누르면 다음 phase로 — 팝오버/시트 위로 하이라이트가 옮겨가거나
// 결과 안내를 보여준다). DOM 측정·렌더는 ui 레이어가 맡는다.

/** 하이라이트 대상의 안정 식별자 — 자유모드 HUD·팝오버·시트·사이드바에 `data-tour-id`로 부여된다.
 *  `canvas-star`는 3D 캔버스 안 별이라 DOM rect가 없다 → 중앙 안내 fallback. */
export type TourTargetId =
  | 'ui-toggle'
  | 'theme'
  | 'persona'
  | 'persona-popover'
  | 'time'
  | 'time-skip-month'
  | 'menu'
  | 'sidebar-close'
  | 'view'
  | 'telescope'
  | 'explorer-diary-tab'
  | 'explorer-star-tab'
  | 'new-star'
  | 'canvas-star'

/** 단계가 진입할 때 페이지가 자동으로 열 표면(별 탭 단계만). 그 외 팝오버·사이드바·망원경은 사용자가
 *  직접 버튼을 눌러 연다(행동 안내). */
export type TourSurface = 'none' | 'telescope-star'

/** 이 phase를 완료(다음 phase로)하기 위한 사용자 행동 신호. null이면 행동 없이 `다음`으로 진행한다.
 *  '*-changed'/'*-moved'는 단계 진입 시점 기준 변화(페르소나 전환·가상 시계 이동)를 관찰한다. */
export type TourAwait =
  | 'ui-hidden'
  | 'ui-shown'
  | 'persona-open'
  | 'persona-changed'
  | 'time-open'
  | 'time-moved'
  | 'sidebar-open'
  | 'explorer-open'
  | null

export interface TourPhase {
  /** 이 phase에서 하이라이트할 대상. null이면 중앙 안내 카드만(주변 딤은 클릭을 막지 않는다). */
  target: TourTargetId | null
  /** 짧은 안내 문구. */
  body: string
  /** 이 행동이 일어나면 자동으로 다음 phase로 넘어간다(없으면 `다음` 버튼). */
  await: TourAwait
}

export interface TourStep {
  id: string
  title: string
  /** 페이지가 이 단계에서 자동으로 열 표면(별 탭 단계만). */
  surface: TourSurface
  phases: TourPhase[]
}

/** 투어 순서(plan 48 §단계 시나리오) — 자유모드 버튼을 하나씩 직접 눌러보며 익힌다. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'ui-toggle',
    title: 'UI 숨기기',
    surface: 'none',
    phases: [
      { target: 'ui-toggle', body: '먼저 이 버튼이에요. 화면의 버튼들을 잠시 숨길 수 있어요 — 한번 눌러볼까요?', await: 'ui-hidden' },
      { target: 'ui-toggle', body: '우주만 남았죠. 다시 누르면 버튼들이 돌아와요. 눌러보세요.', await: 'ui-shown' },
      { target: 'ui-toggle', body: '잘했어요! 우주만 보고 싶을 때 이렇게 접어둘 수 있어요.', await: null },
    ],
  },
  {
    id: 'theme',
    title: '테마',
    surface: 'none',
    phases: [{ target: 'theme', body: '스킨과 감정 색으로 우주의 분위기를 바꾸는 곳이에요.', await: null }],
  },
  {
    id: 'persona',
    title: '페르소나',
    surface: 'none',
    phases: [
      { target: 'persona', body: '이 버튼을 눌러볼까요?', await: 'persona-open' },
      { target: 'persona-popover', body: '다른 사람의 우주로 바꿀 수 있어요. 하나 골라보세요.', await: 'persona-changed' },
      {
        target: null,
        body: '저마다 뇌가 다르듯, 우리의 기억도 다르게 빚어져요. 같은 하루도 누군가의 우주에선 전혀 다른 별이 되죠. 다음으로 넘어가요.',
        await: null,
      },
    ],
  },
  {
    id: 'time',
    title: '시간',
    surface: 'none',
    phases: [
      { target: 'time', body: '이번엔 시간 버튼이에요. 눌러볼까요?', await: 'time-open' },
      { target: 'time-skip-month', body: '`한 달 후로 이동`을 눌러볼까요?', await: 'time-moved' },
      {
        target: null,
        body: '한 달 뒤로 이동했어요. 오래 떠올리지 않은 별은 그만큼 빛이 바래고, 어떤 별은 잠들어요. 다음으로 넘어가요.',
        await: null,
      },
    ],
  },
  {
    id: 'menu',
    title: '메뉴',
    surface: 'none',
    phases: [
      { target: 'menu', body: '체험 종료와 일기 같은 메뉴가 여기 모여 있어요. 눌러볼까요?', await: 'sidebar-open' },
      { target: 'sidebar-close', body: '✕ 버튼을 눌러 다시 닫을 수 있어요.', await: null },
    ],
  },
  {
    id: 'view',
    title: '시점 전환',
    surface: 'none',
    phases: [
      { target: 'view', body: '멀리서 우주를 조망하거나, 별들 가까이서 탐험하는 시점을 오갈 수 있어요.', await: null },
    ],
  },
  {
    id: 'telescope',
    title: '망원경',
    surface: 'none',
    phases: [
      { target: 'telescope', body: '우주 안의 일기와 별을 찾는 입구예요. 눌러볼까요?', await: 'explorer-open' },
      {
        target: 'explorer-diary-tab',
        body: '일기 탭이에요 — 원본 일기를 검색하고, 그 일기에서 태어난 별들을 함께 볼 수 있어요.',
        await: null,
      },
    ],
  },
  {
    id: 'explorer-star-tab',
    title: '별 탭',
    surface: 'telescope-star',
    phases: [
      { target: 'explorer-star-tab', body: '별 탭에선 깨어 있는 별과 잠든 별을 한자리에서 찾아볼 수 있어요.', await: null },
    ],
  },
  {
    id: 'new-star',
    title: '새 별 띄우기',
    surface: 'none',
    phases: [
      { target: 'new-star', body: '눌러보세요 — 오늘 날짜의 별 몇 개가 바로 태어나 우주에 떠올라요.', await: null },
    ],
  },
  {
    id: 'star-click',
    title: '별을 눌러 기억을 읽어요',
    surface: 'none',
    phases: [
      { target: 'canvas-star', body: '별 하나를 누르면 그 안의 기억 조각과 일기를 펼쳐 회상할 수 있어요.', await: null },
    ],
  },
  {
    id: 'end',
    title: '이제 자유롭게 탐험해볼까요?',
    surface: 'none',
    phases: [
      { target: null, body: '둘러보기는 여기까지예요. 마음껏 별을 띄우고, 떠올리고, 시간을 돌려보세요.', await: null },
    ],
  },
]

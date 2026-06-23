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
  | 'time-speed'
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
 *  '*-changed'/'*-moved'는 단계 진입 시점 기준 변화(페르소나 전환·가상 시계 이동)를 관찰한다.
 *  'nebula-*'/'recall-*'(change 12)는 항해 실습 — navigation-input 누적 카운터·항해 FSM 모드를 ui
 *  레이어가 rAF로 샘플링해 임계 도달 시 충족(매 프레임 React state 금지·헌법4). 모델은 이름만 안다. */
export type TourAwait =
  | 'ui-hidden'
  | 'ui-shown'
  | 'persona-open'
  | 'persona-changed'
  | 'time-open'
  | 'time-moved'
  | 'sidebar-open'
  | 'explorer-open'
  | 'nebula-rotated'
  | 'nebula-zoomed'
  | 'recall-looked'
  | 'recall-thrusted'
  | null

/** 항해 실습 phase가 기대하는 카메라 모드(change 12). 페이지가 phase 진입 시 nav를 이 모드로 맞추고,
 *  실습 segment를 벗어나면 기본(멀리서)으로 정리한다. 비-실습 phase는 undefined(모드 미관여). */
export type TourCameraMode = 'nebula' | 'recall'

/** 디바이스 분기 문구(change 12) — 비터치(웹)는 mouse, 터치(모바일)는 touch. 단일 string이면 공용. */
export type TourBody = string | { mouse: string; touch: string }

export interface TourPhase {
  /** 이 phase에서 하이라이트할 대상. null이면 중앙 안내 카드만(주변 딤은 클릭을 막지 않는다). */
  target: TourTargetId | null
  /** 짧은 안내 문구(디바이스 분기 가능). */
  body: TourBody
  /** 이 행동이 일어나면 자동으로 다음 phase로 넘어간다(없으면 `다음` 버튼). */
  await: TourAwait
  /** 항해 실습 phase가 기대하는 카메라 모드(change 12). 없으면 모드 미관여. */
  mode?: TourCameraMode
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
      // 정보 phase(await=null) — 배속은 골라도 정지를 골라도 멈추지 않고 `다음`으로 진행한다.
      // (행동 게이트로 두면 '정지' 선택 시 가상 시계가 멈춰 time-moved가 영영 안 와 단계가 막힌다.)
      {
        target: 'time-speed',
        body: '여기서 시간이 흐르는 배속을 골라요. 시간이 흐르면 오래 떠올리지 않은 별은 빛이 바래고, 밤마다 우주가 스스로 정리돼요.',
        await: null,
      },
    ],
  },
  {
    id: 'view',
    title: '시점 전환',
    surface: 'none',
    phases: [
      // ① 안내(현행 유지) — 두 시점을 직접 오가며 항해를 익혀본다.
      {
        target: 'view',
        body: '멀리서 우주를 조망하거나, 별들 가까이서 탐험하는 시점을 오갈 수 있어요. 직접 움직여볼까요?',
        await: null,
        mode: 'nebula',
      },
      // ② 멀리서 회전
      {
        target: null,
        mode: 'nebula',
        await: 'nebula-rotated',
        body: {
          mouse: '먼저 멀리서 봐요. 마우스로 우주를 잡고 끌어 돌려보세요.',
          touch: '먼저 멀리서 봐요. 한 손가락으로 우주를 쓸어 돌려보세요.',
        },
      },
      // ③ 멀리서 줌
      {
        target: null,
        mode: 'nebula',
        await: 'nebula-zoomed',
        body: {
          mouse: '이번엔 마우스 휠을 굴려 우주를 가까이 당겨보세요.',
          touch: '이번엔 두 손가락을 오므렸다 펴서 우주를 당겨보세요.',
        },
      },
      // ④ 가까이서로 전환(투어가 시점을 구동) — 정보 phase.
      {
        target: null,
        mode: 'recall',
        await: null,
        body: '이제 별들 사이로 들어가 볼까요? 시점을 가까이서로 바꿨어요. 빛을 든 내가 별 사이에 섰어요.',
      },
      // ⑤ 가까이서 시선
      {
        target: null,
        mode: 'recall',
        await: 'recall-looked',
        body: {
          mouse: '마우스로 드래그해 주위를 둘러보세요.',
          touch: '한 손가락으로 드래그해 주위를 둘러보세요.',
        },
      },
      // ⑥ 가까이서 전진
      {
        target: null,
        mode: 'recall',
        await: 'recall-thrusted',
        body: {
          mouse: '앞으로 나아가 볼까요? 화면의 전진 버튼을 누르거나 W·↑ 키로 별 쪽으로 다가가요.',
          touch: '두 손가락을 위로 쓸어 별 쪽으로 다가가 보세요.',
        },
      },
      // ⑦ 마무리(전진 충족 시 자동 도달) — 다음 단계로는 `다음`으로.
      {
        target: null,
        mode: 'recall',
        await: null,
        body: '좋아요! 이렇게 두 시점을 오가며 별 사이를 누벼요. 다음으로 가요.',
      },
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

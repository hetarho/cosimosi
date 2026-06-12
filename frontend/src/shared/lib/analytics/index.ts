// 제품 분석 래퍼 (spec 18) — PostHog 위의 얇은 타입 계층. 이벤트 이름과 속성 모양을
// 여기 한 곳에 못 박아(EventProps) 오타 계측과 "본문이 슬쩍 실리는" 사고를 컴파일에서
// 막는다: 일기 body·임베딩·기억 내용은 어떤 이벤트에도 싣지 않는다(프라이버시 헌법 1).
// 본문 관련은 길이 버킷(short/medium/long)과 mood까지만.
//
// VITE_POSTHOG_KEY가 없으면 init이 스킵되고 capture/identify 전부 no-op — 로컬 dev와
// 체험 모드는 아무 영향이 없다(3.1). react/three import 금지(pure 레이어, 3.7);
// posthog-js는 DOM 전역만 쓰는 비 react 라이브러리라 허용이다.
import posthog from 'posthog-js'
import { isDemoMode } from '../demo'

/** 이벤트 이름 상수 — 계측 지점은 반드시 이 키로 capture한다(이벤트 설계표, spec 18). */
export const EVENTS = {
  /** 가입/재방문 — 세션 복원 포함, uid가 새로 확인될 때마다. */
  signIn: 'sign_in',
  /** 우주 첫 렌더 완료 — 렌더러 백엔드(폴백 비율)와 로드 시간. */
  universeLoaded: 'universe_loaded',
  /** 일기 작성 시도(서버 왕복) — 코어 루프 발화율. */
  recordMemory: 'record_memory',
  /** 회상 발화(≥2s 체류) — 잠든 별 재점화 여부 포함. */
  recallOpen: 'recall_open',
  /** 공동 회상 강화 배치 전송 성공. */
  reinforceFlush: 'reinforce_flush',
  /** 잠든 별 페이지 방문 — 기능 발견율. */
  dormantVisit: 'dormant_visit',
  /** 테마 전환 — 외형 기능 사용률. */
  appearanceSwitch: 'appearance_switch',
} as const

export type BodyLengthBucket = 'short' | 'medium' | 'long'

/** 이벤트별 허용 속성의 닫힌 목록 — 자유 텍스트 필드가 없어 본문이 끼어들 수 없다. */
interface EventProps {
  sign_in: Record<string, never>
  universe_loaded: {
    star_count: number
    synapse_count: number
    load_ms: number
    renderer: 'webgpu' | 'webgl2'
  }
  // 감정이 조각 단위(검토 후 확정)가 되면서 fragment_count가 새 신호다. mood는 기존
  // 대시보드(스펙 18 설계표)가 깨지지 않게 상수 'auto'로 유지한다.
  record_memory: {
    mood: string
    fragment_count: number
    body_length_bucket: BodyLengthBucket
    success: boolean
  }
  recall_open: { is_dormant: boolean }
  reinforce_flush: { pair_count: number }
  dormant_visit: { dormant_count: number }
  appearance_switch: { theme: string }
}

type EventName = keyof EventProps

let enabled = false

/**
 * 부팅 1회(main.tsx). key가 없으면 PostHog를 아예 초기화하지 않는다 — 이후 모든
 * capture/identify가 no-op(3.1). 프라이버시 설정은 보수적 기본:
 *  - mask_all_text/attributes: autocapture가 어떤 요소 텍스트도 줍지 않게(일기 화면 가드).
 *  - disable_session_recording: Replay 미도입(스펙의 선택 항목 — 백로그).
 *  - person_profiles 'identified_only': 익명 방문자는 프로필을 만들지 않는다.
 */
export function initAnalytics(opts: { key?: string; host?: string }): void {
  if (!opts.key || enabled) return // 키 없으면 영구 no-op; 이중 init 무시
  posthog.init(opts.key, {
    api_host: opts.host || 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_session_recording: true,
  })
  enabled = true
}

/**
 * 타입화된 capture. 모든 이벤트에 demo(체험 모드 여부)를 공통 속성으로 붙인다 —
 * 체험 트래픽이 베타 퍼널(작성→회상→재방문)을 오염시키지 않게 대시보드에서 거른다.
 */
export function capture<E extends EventName>(event: E, props: EventProps[E]): void {
  if (!enabled) return
  posthog.capture(event, { ...props, demo: isDemoMode() })
}

/** 사인인 시 호출 — 식별자는 Supabase uid만(PII 최소화, 프라이버시 헌법 4). */
export function identifyUser(userId: string): void {
  if (!enabled) return
  posthog.identify(userId)
}

/** 사인아웃/계정 전환 시 호출 — 다음 방문자가 이전 uid로 이어지지 않게 끊는다. */
export function resetAnalyticsIdentity(): void {
  if (!enabled) return
  posthog.reset()
}

// 본문 길이 버킷 경계(코드포인트). 정전 값은 policy/ux/analytics-privacy.md.
const BODY_SHORT_MAX = 100
const BODY_MEDIUM_MAX = 500

/** 본문 길이 → 버킷(원문/길이 원값은 보내지 않는다). 코드포인트 기준(서버 상한과 동일 단위). */
export function bodyLengthBucket(codePoints: number): BodyLengthBucket {
  if (codePoints <= BODY_SHORT_MAX) return 'short'
  if (codePoints <= BODY_MEDIUM_MAX) return 'medium'
  return 'long'
}

// --- universe_loaded 합류 지점 ---
// 렌더러 백엔드(캔버스 onCreated)와 우주 데이터(GetUniverse 성공)는 서로 다른 시점에
// 비동기로 도착한다. 둘 다 모이면 1회만 보낸다(페이지 로드당 1회 — 초기 경험 지표).
// load_ms는 페이지 오픈(time origin)부터 우주가 처음 그려질 준비가 된 순간까지.

let universeRenderer: 'webgpu' | 'webgl2' | null = null
let universeCounts: { star_count: number; synapse_count: number } | null = null
let universeLoadedSent = false

export function reportUniverseRenderer(renderer: 'webgpu' | 'webgl2'): void {
  if (universeRenderer == null) universeRenderer = renderer
  maybeCaptureUniverseLoaded()
}

export function reportUniverseData(counts: { star_count: number; synapse_count: number }): void {
  if (universeCounts == null) universeCounts = counts
  maybeCaptureUniverseLoaded()
}

function maybeCaptureUniverseLoaded(): void {
  if (universeLoadedSent || universeRenderer == null || universeCounts == null) return
  universeLoadedSent = true
  capture(EVENTS.universeLoaded, {
    ...universeCounts,
    renderer: universeRenderer,
    load_ms: Math.round(performance.now()),
  })
}

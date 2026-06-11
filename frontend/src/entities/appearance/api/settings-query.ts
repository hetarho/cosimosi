// GetSettings/UpdateSettings 데이터 계층(spec 30): connect-query 쿼리 옵션 + 서버→store
// 동기화(applySettings) + 쓰기(pushSettings). 서버는 사용자 오버라이드만 주고받고, store가
// 기본값(테마/오브제/MOOD_PALETTE) 위에 머지한다. no three/React/DOM(헌법4) — 옵션 빌더 + 순수 매핑.
import { callUnaryMethod, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  GetSettingsResponseSchema,
  Mood,
  SettingsService,
  getAccessToken,
  transport,
  type GetSettingsResponse,
  type Settings as ProtoSettings,
} from '@/shared/api'
import { isDemoMode } from '@/shared/lib/demo'
import { useAppearance, type ServerAppearance } from '../model/store'

// 단일 작성자 + per-user 설정: 이벤트(변경 시 직접 store 갱신)가 갱신을 끌고, focus refetch는
// 멀티 디바이스 드리프트만 커버하는 안전망(universe-query와 동일 정책).
const SETTINGS_STALE_MS = 5 * 60_000
const SETTINGS_GC_MS = 30 * 60_000

function buildSettingsQueryOptions() {
  const base = createQueryOptions(SettingsService.method.getSettings, {}, { transport })
  return queryOptions({
    ...base,
    // 체험 모드: 서버 없이 빈 오버라이드(전부 기본값) — 같은 쿼리 경로로 태운다(UI 분기 제거).
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetSettingsResponse> =>
      isDemoMode()
        ? Promise.resolve(create(GetSettingsResponseSchema, {}))
        : callUnaryMethod(transport, SettingsService.method.getSettings, {}, { signal }),
    staleTime: SETTINGS_STALE_MS,
    gcTime: SETTINGS_GC_MS,
    // 설정은 드물게 바뀜 — 포커스 refetch는 쓰기와 경합해 잠깐 되돌릴 수 있고 이득이 작다.
    // 시드는 우주 진입 1회로 충분(쓰기는 store를 직접 갱신하고 응답으로 재동기화).
    refetchOnWindowFocus: false,
  })
}

let settingsOptionsCache: ReturnType<typeof buildSettingsQueryOptions> | undefined

/** GetSettings 쿼리 옵션 — 인증된 우주 페이지에서 마운트(랜딩/미인증은 기본값 사용). */
export function settingsQueryOptions() {
  return (settingsOptionsCache ??= buildSettingsQueryOptions())
}

/** proto Settings(오버라이드) → store 형태. mood enum → 소문자 이름 키. */
function toServerAppearance(s: ProtoSettings | undefined): ServerAppearance {
  const emotionColors: Record<string, string> = {}
  for (const ec of s?.emotionColors ?? []) {
    if (ec.mood === Mood.MOOD_UNSPECIFIED) continue
    const name = Mood[ec.mood] // 숫자 enum 역매핑 → "JOY" 등
    if (name) emotionColors[name.toLowerCase()] = ec.color
  }
  return { theme: s?.theme || undefined, object: s?.starObject || undefined, emotionColors }
}

/** GetSettings 성공 → appearance store 시드(서버 오버라이드를 기본값 위에 머지). */
export function applySettings(res: GetSettingsResponse): void {
  useAppearance.getState().applyServerSettings(toServerAppearance(res.settings))
}

/** 변경 쓰기(낙관적 store 갱신 *후* 호출). 체험 모드이거나 인증 세션이 없으면 서버 쓰기를
 *  건너뛴다(로컬 localStorage 변경만) — 401 잡음·체험 오염 방지. 성공 시 서버 머지 결과로 재동기화. */
export async function pushSettings(patch: {
  theme?: string
  starObject?: string
  emotionColors?: { mood: Mood; color: string }[]
}): Promise<void> {
  if (isDemoMode()) return
  const token = await getAccessToken()
  if (!token) return
  try {
    const res = await callUnaryMethod(transport, SettingsService.method.updateSettings, patch, {})
    if (res.settings) useAppearance.getState().applyServerSettings(toServerAppearance(res.settings))
  } catch (e) {
    // 비차단(fire-and-forget): 낙관적 로컬 변경은 그대로 두고, 다음 GetSettings 시드가
    // 서버와 재동기화한다. void 호출이라 여기서 삼키지 않으면 미처리 rejection이 된다.
    console.error('[settings.push]', e)
  }
}

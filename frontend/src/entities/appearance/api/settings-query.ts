// GetSettings/UpdateSettings + GetInventory/PurchaseItem 데이터 계층(spec 30·44): connect-query 쿼리
// 옵션 + 서버→store 동기화(applySettings/applyInventory) + 쓰기(pushSettings/purchaseItem). 서버는
// 사용자 오버라이드·자산만 주고받고, store가 기본값(4축/MOOD_PALETTE) 위에 머지한다. no three/React/DOM
// (헌법4) — 옵션 빌더 + 순수 매핑. 별가루 잔액·소유권은 서버 권위(클라가 못 속인다).
import { callUnaryMethod, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  GetSettingsResponseSchema,
  GetInventoryResponseSchema,
  Mood,
  SettingsService,
  getAccessToken,
  transport,
  type GetSettingsResponse,
  type GetInventoryResponse,
  type Settings as ProtoSettings,
} from '@/shared/api'
import { VALUES } from '@/shared/config'
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

function buildInventoryQueryOptions() {
  const base = createQueryOptions(SettingsService.method.getInventory, {}, { transport })
  return queryOptions({
    ...base,
    // 체험/미인증: 서버 없이 빈 인벤토리(시작 잔액 + 소유 없음) — 같은 경로로 태운다.
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetInventoryResponse> =>
      isDemoMode()
        ? Promise.resolve(
            create(GetInventoryResponseSchema, {
              stardust: BigInt(VALUES.customization.startingStardust),
              ownedItemIds: [],
            }),
          )
        : callUnaryMethod(transport, SettingsService.method.getInventory, {}, { signal }),
    staleTime: SETTINGS_STALE_MS,
    gcTime: SETTINGS_GC_MS,
    refetchOnWindowFocus: false,
  })
}

let inventoryOptionsCache: ReturnType<typeof buildInventoryQueryOptions> | undefined

/** GetInventory 쿼리 옵션 — 인증된 우주 페이지에서 마운트(시드 + 잔액·소유권 로드, A1). */
export function inventoryQueryOptions() {
  return (inventoryOptionsCache ??= buildInventoryQueryOptions())
}

/** proto Settings(오버라이드) → store 형태. mood enum → 소문자 이름 키. */
function toServerAppearance(s: ProtoSettings | undefined): ServerAppearance {
  const emotionColors: Record<string, string> = {}
  for (const ec of s?.emotionColors ?? []) {
    if (ec.mood === Mood.MOOD_UNSPECIFIED) continue
    const name = Mood[ec.mood] // 숫자 enum 역매핑 → "JOY" 등
    if (name) emotionColors[name.toLowerCase()] = ec.color
  }
  return {
    theme: s?.theme || undefined,
    object: s?.starObject || undefined,
    selfObject: s?.selfObject || undefined,
    synapseStyle: s?.synapseStyle || undefined,
    emotionColors,
  }
}

/** GetSettings 성공 → appearance store 시드(서버 오버라이드를 기본값 위에 머지). */
export function applySettings(res: GetSettingsResponse): void {
  useAppearance.getState().applyServerSettings(toServerAppearance(res.settings))
}

/** GetInventory 성공 → appearance store에 잔액·소유권 적용(서버 권위). */
export function applyInventory(res: GetInventoryResponse): void {
  useAppearance.getState().applyInventory({
    stardust: Number(res.stardust),
    ownedItemIds: res.ownedItemIds,
  })
}

/** 변경 쓰기(4축/감정색). 체험 모드이거나 인증 세션이 없으면 서버 쓰기를 건너뛴다(로컬만) — 401 잡음·체험
 *  오염 방지. 성공 시 서버 머지 결과로 재동기화하고 **true**, 그 외(스킵·실패)는 **false**를 반환한다 —
 *  저장 바가 성공일 때만 드래프트를 커밋(기준선 갱신)하도록. */
export async function pushSettings(patch: {
  theme?: string
  starObject?: string
  selfObject?: string
  synapseStyle?: string
  emotionColors?: { mood: Mood; color: string }[]
}): Promise<boolean> {
  if (isDemoMode()) return false
  const token = await getAccessToken()
  if (!token) return false
  try {
    const res = await callUnaryMethod(transport, SettingsService.method.updateSettings, patch, {})
    if (res.settings) useAppearance.getState().applyServerSettings(toServerAppearance(res.settings))
    return true
  } catch (e) {
    // 낙관적 로컬 변경은 그대로 두고, 다음 GetSettings 시드가 서버와 재동기화한다.
    console.error('[settings.push]', e)
    return false
  }
}

/** 유료 아이템 구매(spec 44). store가 낙관적으로 차감·부여(revert 반환)하고, RPC 성공 시 서버 권위로
 *  덮어쓴다. 실패하면 revert로 되돌리고 에러를 throw해 호출자가 자동선택을 취소한다(A2). 체험·미인증은
 *  구매 경로가 노출되지 않지만(플레이그라운드는 전부 unlocked), 방어적으로 서버 쓰기를 건너뛴다. */
export async function purchaseItem(itemId: string): Promise<void> {
  // 데모·미인증은 구매가 없다(플레이그라운드는 전부 unlocked). 낙관적 변경은 *실제로 RPC를 칠 때만* 건다
  // — 가드에서 일찍 빠져나가면 되돌릴 게 없어 store가 권위 없이 영구 오염되는 걸 막는다.
  if (isDemoMode()) return
  const token = await getAccessToken()
  if (!token) return
  const revert = useAppearance.getState().purchaseItem(itemId) // 낙관적 차감+부여(revert 반환)
  try {
    const res = await callUnaryMethod(transport, SettingsService.method.purchaseItem, { itemId }, {})
    useAppearance.getState().applyInventory({
      stardust: Number(res.stardust),
      ownedItemIds: res.ownedItemIds,
    })
  } catch (e) {
    revert() // 잔액·소유권을 구매 전으로 되돌린다 — chip은 다시 잠김(buyable)으로
    throw e
  }
}

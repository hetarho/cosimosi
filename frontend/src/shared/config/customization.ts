// 커스터마이즈 경제 순수 헬퍼(spec 44) — 가격·무료여부·소유 판정을 생성 상수(VALUES.customization)에서
// 단일 출처로 읽는다. FE/BE 하드코딩·이중 출처 금지(A14): 가격·무료 매핑은 spec/values.yaml에서 생성된다.
// three/React/DOM 없음(pure config). mood.ts 방어 스타일 — 알 수 없는 id에 throw하지 않고 안전 폴백한다.
import { VALUES } from './values.gen'

/** 4축 커스터마이즈 축. 각 축은 store 선택 필드와 짝: background→theme·star→object·self→selfObject·synapse→synapseStyle. */
export type Axis = 'background' | 'star' | 'self' | 'synapse'

// 가격표는 콜론 포함 id 키라 인덱싱 위해 Record로 본다(생성 상수는 좁은 리터럴 키 타입).
const PRICE = VALUES.customization.price as Record<string, number>

/** 축별 무료 kind에서 파생한 무료 아이템 id 집합(묵시 소유). VALUES.customization.free가 단일 출처(A11). */
const FREE_ITEM_IDS: ReadonlySet<string> = new Set(
  Object.entries(VALUES.customization.free).map(([axis, kind]) => `${axis}:${kind}`),
)

/** 안정 아이템 id 조립 — `"<axis>:<kind>"`(A14). */
export function itemId(axis: Axis, kind: string): string {
  return `${axis}:${kind}`
}

/** 무료(묵시 소유) 아이템인가. */
export function isFree(id: string): boolean {
  return FREE_ITEM_IDS.has(id)
}

/** 유료 아이템 가격(별가루). 무료·알 수 없는 id면 undefined. */
export function priceOf(id: string): number | undefined {
  return PRICE[id]
}

/** 선택 가능한가 — 무료이거나 소유 집합에 든 유료 아이템(A4 선택-소유권 규칙). */
export function isOwned(id: string, ownedItemIds: ReadonlySet<string>): boolean {
  return isFree(id) || ownedItemIds.has(id)
}

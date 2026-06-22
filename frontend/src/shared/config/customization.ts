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

/** 안정 아이템 id 조립 — `"<axis>:<kind>"`(A14). 형태×표면 sub-item은 kind에 슬롯을 넣어
 *  `itemId('star', 'form:lowpoly')` = `"star:form:lowpoly"`로 만든다. */
export function itemId(axis: Axis, kind: string): string {
  return `${axis}:${kind}`
}

/** 한 축 선택이 소유를 요구하는 sub-item id 목록(spec 52). 배경은 단일 id, 형태 있는 3축(별·나·시냅스)은
 *  합성 선택 "<form>+<surface>"를 두 sub-item(`"<axis>:form:<f>"`·`"<axis>:surface:<s>"`)으로 분해한다 —
 *  합성 선택의 소유 = 양쪽 sub-item 소유(또는 무료). 순수 문자열 연산(entity 미import). */
export function subItemIds(axis: Axis, selection: string): string[] {
  if (axis === 'background') return [itemId(axis, selection)]
  const [form, surface] = selection.split('+')
  return [`${axis}:form:${form}`, `${axis}:surface:${surface}`]
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

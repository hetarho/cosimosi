// Cross-import public API (FSD `@x`) — entities/star 전용. star의 렌더(StarField)가 구독하는
// memory 조각만 노출한다. star는 이 파일에서만 memory를 가져온다(일반 index.ts 직접 import 금지).
export { useMemoryStore, starsOfRecord } from '../model/store'
// 별 밝기 = 자기-거리(반지름)를 빛으로 읽기(spec 38 change 19) — 별도 시간·연결 감쇠 채널 없음. color=mood.
export { starGlow } from '../model/activation'
export { reshapedBrightness, reshapedSeed, reshapedShapeSeed } from '../model/reshape'
// 겹쳐보기(spec 37): StarField가 스토어 대신 외부 별 소스를 그릴 때(두 우주 동시 렌더) prop 타입.
export type { StarNode } from '../model/types'

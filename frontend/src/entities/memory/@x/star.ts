// Cross-import public API (FSD `@x`) — entities/star 전용. star의 렌더(StarField)가 구독하는
// memory 조각만 노출한다. star는 이 파일에서만 memory를 가져온다(일반 index.ts 직접 import 금지).
export { useMemoryStore, starsOfRecord } from '../model/store'
// spec 03 3채널: reflection=activation(recency) · self-glow=selfGlow(연결성·λ_glow) · color=mood.
// modulatedBrightness는 전환기 호환·테스트용으로 남긴다(StarField는 selfGlow+activation으로 갈아탄다).
export { starBrightness, modulatedBrightness, activation, selfGlow, connectedness } from '../model/activation'
export { reshapedBrightness, reshapedSeed } from '../model/reshape'
// 겹쳐보기(spec 37): StarField가 스토어 대신 외부 별 소스를 그릴 때(두 우주 동시 렌더) prop 타입.
export type { StarNode } from '../model/types'

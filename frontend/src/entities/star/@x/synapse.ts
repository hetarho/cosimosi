// Cross-import public API (FSD `@x`) — entities/synapse 전용. VizSynapse의 concept(별 종류) 타입과
// 별 부유 파라미터(시냅스 끝이 별 중앙을 따라가는 데 필요)를 노출한다.
// synapse는 이 파일에서만 star를 가져온다.
export type { StarObject } from '../model/types'
export { WOBBLE_AMP, WOBBLE_FREQ, WOBBLE_PHASE } from '../model/wobble'

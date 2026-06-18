// Cross-import public API (FSD `@x`) — entities/star 전용. StarField가 별별 변조 감쇠
// (spec 26)의 R_conn 입력으로 쓰는 연결 정보만 노출한다: 라이브 엣지 스토어 + degree
// 정규화 셀렉터. star는 이 파일에서만 synapse를 가져온다(일반 index.ts 직접 import 금지).
export { useSynapseStore, degreeNormById, weightedDegreeById } from '../model/store'
export type { SynapseEdge } from '../model/types'

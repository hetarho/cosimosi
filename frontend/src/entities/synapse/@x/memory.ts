// Cross-import public API (FSD `@x`) — entities/memory 전용. GetUniverse가 불러온 데이터를
// 동기화할 때 쓰는 synapse 스토어 조각만 노출한다. memory는 이 파일에서만 synapse를 가져온다.
export { toSynapseEdge, useSynapseStore } from '../model/store'

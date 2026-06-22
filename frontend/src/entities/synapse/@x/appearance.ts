// Cross-import public API (FSD `@x`) — entities/appearance 전용. appearance store가 '선택'으로
// 운반하는 시냅스 스타일 타입·목록·기본값만 노출한다. appearance는 이 파일에서만 synapse를 가져온다.
export type { SynapseStyle, SynapseStyleMeta } from '../model/styles'
export { SYNAPSE_STYLES, DEFAULT_SYNAPSE_STYLE, isSynapseStyle, parseSynapseStyle } from '../model/styles'

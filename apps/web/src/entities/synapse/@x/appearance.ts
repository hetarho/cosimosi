// Cross-import public API (FSD `@x`) — entities/appearance 전용. appearance store가 '선택'으로
// 운반하는 시냅스 스타일 타입·목록·기본값 + 형태×표면 2축 스킨(spec 52) 카탈로그·합성 인코딩만 노출한다.
// appearance는 이 파일에서만 synapse를 가져온다.
export type { SynapseStyle, SynapseStyleMeta } from '../model/styles'
export { SYNAPSE_STYLES, DEFAULT_SYNAPSE_STYLE, isSynapseStyle, parseSynapseStyle } from '../model/styles'
export {
  type SynapseForm,
  type SynapseSurface,
  type SynapseSelection,
  type SynapseSkinMeta,
  SYNAPSE_FORMS,
  SYNAPSE_SURFACES,
  DEFAULT_SYNAPSE_FORM,
  DEFAULT_SYNAPSE_SURFACE,
  DEFAULT_SYNAPSE_SELECTION,
  parseSynapseForm,
  parseSynapseSurface,
  encodeSynapseSelection,
  decodeSynapseSelection,
  normalizeSynapseSelection,
} from '../model/forms'

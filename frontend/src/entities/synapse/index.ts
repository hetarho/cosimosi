// Public API for the synapse entity (named exports — no wildcard barrel).
export { SynapseFilaments, type SynapseFilamentsProps } from './ui/SynapseFilaments'
export { SynapseDust, type SynapseDustProps } from './ui/SynapseDust'
export { VizSynapse, type VizSynapseProps } from './ui/VizSynapse'
export type { SynapseEdge } from './model/types'
// 시냅스 스타일 카탈로그(spec 44 시냅스 축) — 레거시 디컴포지션·2D 프리뷰가 소비.
export {
  SYNAPSE_STYLES,
  DEFAULT_SYNAPSE_STYLE,
  isSynapseStyle,
  parseSynapseStyle,
  type SynapseStyle,
} from './model/styles'
// 형태×표면 2축 스킨(spec 52) — 카탈로그·디컴포지션·합성 인코딩.
export {
  type SynapseForm,
  type SynapseSurface,
  type SynapseSelection,
  type SynapseSkinMeta,
  SYNAPSE_FORMS,
  SYNAPSE_SURFACES,
  SYNAPSE_PRESETS,
  DEFAULT_SYNAPSE_FORM,
  DEFAULT_SYNAPSE_SURFACE,
  DEFAULT_SYNAPSE_SELECTION,
  parseSynapseForm,
  parseSynapseSurface,
  encodeSynapseSelection,
  decodeSynapseSelection,
  normalizeSynapseSelection,
} from './model/forms'
export {
  useSynapseStore,
  toSynapseEdge,
  neighborsOf,
  edgesWithin,
} from './model/store'

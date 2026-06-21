// Public API for the synapse entity (named exports — no wildcard barrel).
export { SynapseFilaments, type SynapseFilamentsProps } from './ui/SynapseFilaments'
export { SynapseDust, type SynapseDustProps } from './ui/SynapseDust'
export { VizSynapse, type VizSynapseProps } from './ui/VizSynapse'
export type { SynapseEdge } from './model/types'
// 시냅스 스타일 카탈로그(spec 44 시냅스 축) — 스위처·렌더가 소비.
export {
  SYNAPSE_STYLES,
  DEFAULT_SYNAPSE_STYLE,
  type SynapseStyle,
} from './model/styles'
export {
  useSynapseStore,
  toSynapseEdge,
  neighborsOf,
  edgesWithin,
} from './model/store'

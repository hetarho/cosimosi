// Public API for the synapse entity (named exports — no wildcard barrel).
export { SynapseFilaments, type SynapseFilamentsProps } from './ui/SynapseFilaments'
export { SynapseDust, type SynapseDustProps } from './ui/SynapseDust'
export { SynapseLines, type SynapseLinesProps } from './ui/SynapseLines'
export { VizSynapse, type VizSynapseProps } from './ui/VizSynapse'
export { synapseCurve } from './lib/curve'
export type { SynapseEdge, LinkType } from './model/types'
export {
  useSynapseStore,
  toSynapseEdge,
  neighborsOf,
  edgesWithin,
  degreeNormById,
  type UniverseSynapse,
} from './model/store'
export {
  A_MIN,
  ALPHA_MIN,
  ALPHA_MAX,
  THICK_THRESHOLD,
  WIDTH_THIN_PX,
  WIDTH_THICK_PX,
  STRAND_TIERS,
  type StrandStyle,
  visualIntensity,
  emissive,
  alpha,
  pulseAmp,
  vitality,
  strandStyle,
  widthBucket,
  bucketWidthPx,
} from './model/mapping'

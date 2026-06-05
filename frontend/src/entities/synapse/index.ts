// Public API for the synapse entity (named exports — no wildcard barrel).
export { SynapseLines, type SynapseLinesProps } from './ui/SynapseLines'
export type { SynapseEdge, LinkType } from './model/types'
export { useSynapseStore, toSynapseEdge, neighborsOf, type UniverseSynapse } from './model/store'
export {
  A_MIN,
  ALPHA_MIN,
  ALPHA_MAX,
  THICK_THRESHOLD,
  WIDTH_THIN_PX,
  WIDTH_THICK_PX,
  visualIntensity,
  emissive,
  alpha,
  pulseAmp,
  widthBucket,
  bucketWidthPx,
} from './model/mapping'

// @cosimosi/universe-render — the R3F bindings for the universe scene: the instanced star /
// cell-star / filament layers, the nebula color field, the latent-star field, and the awaken
// choreography. Each reads the read-model stores + channel projections from @cosimosi/universe and
// renders through @cosimosi/3d-renderer primitives — the one place domain and visual vocabularies
// meet (§3.4). No DOM / RN primitive here, so both apps consume it verbatim (no *.native fork).
export { StarLayer, type StarLayerProps } from './StarLayer.tsx'
export { CellStarLayer, type CellStarLayerProps } from './CellStarLayer.tsx'
export { FilamentLayer, type FilamentLayerProps } from './FilamentLayer.tsx'
export { LatentStarField, type LatentStarFieldProps } from './LatentStarField.tsx'
export { NebulaField, type NebulaFieldProps } from './NebulaField.tsx'
export { AwakenNeuron, type AwakenNeuronProps } from './AwakenNeuron.tsx'

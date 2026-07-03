// Generic scaffold styling for the placeholder bodies and edge lines — theme content,
// excluded from values.yaml like other palette tables. The real visual bodies bind
// through the asset-source port later without touching this widget (plan 24).
export const UNIVERSE_SCENE_STYLE = {
  neuronBody: { color: '#9fb4ff', radius: 0.42 },
  memoryBody: { color: '#ffe3b8', radius: 0.8 },
  // Muted (edges render opaque 1px lines — see EdgeLineLayer) so filaments stay subtle
  // against nodes; fat-line width is a plan-24 refinement.
  edgeColor: '#3a5f7d',
} as const

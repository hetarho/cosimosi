import * as THREE from 'three/webgpu'

/**
 * How the renderer lands accumulated light on a display.
 *
 * The scene is additive by design — stars, the colour field and the bloom pass all ADD — so a dense
 * region sums past 1 in every channel. Without a curve the pipeline hard-clips per channel: red
 * reaches 1 first, then green, then blue, and the moment all three are pinned the pixel is white.
 * That is why a lone star keeps its colour and a cluster does not: the washout is clipping, not
 * brightness. A tone curve compresses the sum instead of truncating it, so "brighter" stays
 * readable as brighter and hue survives the overlap.
 *
 * Which curve is not arbitrary. Reinhard and ACES both stop the clipping but lift the low mid-tones,
 * and a night sky is almost entirely low mid-tones — the whole frame goes milky and the dark between
 * the stars stops being dark. AgX does the same for the same reason, despite being the wide-gamut
 * choice elsewhere. `neutral` (Khronos PBR Neutral) is the one that fits: it passes mid-tones through
 * untouched and only compresses above ~0.8, so the night is unaffected and a clipping core is pulled
 * back toward its own hue instead of toward white. `rendering.tone_mapping` carries the choice.
 *
 * These are keys, not three constants, because slices never import `three` (§3.5) — the canvas host
 * resolves them. three's own `RenderPipeline` reads `renderer.toneMapping` and folds the curve into
 * the output node after the bloom composite, which is exactly where it belongs, so PostFX needs no
 * knowledge of this.
 */
export type ToneMappingKey =
  'none' | 'linear' | 'reinhard' | 'cineon' | 'aces-filmic' | 'agx' | 'neutral'

const TONE_MAPPING_CONSTANTS: Record<ToneMappingKey, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  'aces-filmic': THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
}

/** Resolve a key to the three constant the renderer wants. Unknown keys fall back to no curve. */
export function resolveToneMapping(key: ToneMappingKey): THREE.ToneMapping {
  return TONE_MAPPING_CONSTANTS[key] ?? THREE.NoToneMapping
}

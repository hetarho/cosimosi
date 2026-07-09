import type { ShaderEffect } from './shader-effect.ts'

// Pixel Blast — inspired by react-bits' PixelBlast shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const pixelBlast: ShaderEffect = {
  key: 'pixel-blast',
  label: 'Pixel Blast',
  blurb:
    "uCount sets the blast's fold-symmetry and the number of radial color zones, while emGradient + weights tint each expanding pixel ring, so 1 emotion is a single-hue circular pulse and 7 is a seven-fold star fanning through the whole palette.",
  fragment: /* glsl */ `
// ---- Pixel Blast: retro pixelated radial energy blast ----
// Ordered Bayer dithering (float-only helpers, safe to define here)
float pbBayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float pbBayer4(vec2 a){ return pbBayer2(0.5 * a) * 0.25 + pbBayer2(a); }
float pbBayer8(vec2 a){ return pbBayer4(0.5 * a) * 0.25 + pbBayer2(a); }

vec3 renderEffect(vec2 uv){
  // Centered, aspect-corrected space (y in [-1,1])
  vec2 p = aspectUv(uv);

  // Quantize to a chunky retro pixel grid: everything is computed from the
  // cell center so each cell is a flat, blocky pixel.
  float grid = 104.0;
  vec2  cell = floor(p * grid);        // integer cell id -> dither/hash coordinate
  vec2  cp   = (cell + 0.5) / grid;    // cell-center position (uniform per pixel)

  // Radial geometry of the blast
  float ang    = atan(cp.y, cp.x);
  float radius = length(cp);

  // uCount drives the SYMMETRY: 1 -> nearly circular, 7 -> seven-fold star.
  float zones = float(max(uCount, 1));
  float warp  = 0.07 * cos(ang * zones + uTime * 0.5);
  float rr    = radius + warp;

  // Repeating pulse rings expanding outward from center on uTime.
  float t         = uTime * 0.35;
  float ringPhase = fract(rr * 2.2 - t);                 // sawtooth sweeping outward
  float e         = (ringPhase - 0.5) / 0.16;            // signed distance from ring center
  float front     = exp(-e * e);                         // bright ring band (no pow -> no NaN)

  // Slow energy field (replaces the original's texture-fed fbm).
  float field = fbm(cp * 2.3 + vec2(0.0, t * 0.4));

  // Static per-cell sparkle (cell-based -> stable under frozen uTime).
  float spark = hash21(cell);

  // Blast energy: bright at the ring front, decaying toward the rim.
  float radial = smoothstep(1.7, 0.0, radius);   // 1 at center -> 0 at edge
  float energy = front * 0.85 + field * 0.30 + radial * 0.18;
  energy += (spark - 0.5) * 0.12;                 // retro grain

  // Ordered dithering -> crisp on/off retro pixels near the front.
  float dither = pbBayer8(cell) - 0.5;
  float lit    = sat(smoothstep(0.44, 0.60, energy + dither * 0.6));

  // Emotion color fans radially, quantized into exactly uCount zones.
  float axisRaw = sat(radius / 1.55);
  float bandId  = min(floor(axisRaw * zones), zones - 1.0);
  float axis    = (bandId + 0.5) / zones;
  vec3  emCol   = emGradient(axis);

  // Deep cosmic base so it never goes flat-black or blinding-white.
  vec3 deep = emBase() * 0.05 + vec3(0.010, 0.012, 0.020);

  vec3 col = deep;
  col += emCol * field * 0.14;                                 // faint palette haze everywhere
  col += emCol * lit * (0.42 + 0.62 * front);                  // lit pixels, brightest at the front
  col += emGradient(fract(axis + 0.5)) * front * lit * 0.22;   // subtle complementary edge glow

  // Vignette keeps the corners deep and UI-friendly.
  col *= 1.0 - 0.28 * dot(p, p);

  // Rich mid-tones, never blinding white.
  col = min(col, vec3(1.0));
  return col;
}
`,
}

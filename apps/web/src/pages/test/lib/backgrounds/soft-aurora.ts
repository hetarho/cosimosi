import type { ShaderEffect } from './shader-effect.ts'

// Soft Aurora — inspired by react-bits' SoftAurora shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const softAurora: ShaderEffect = {
  key: 'soft-aurora',
  label: 'Soft Aurora',
  blurb:
    'uCount cuts the width into that many weight-sized color bands, each owning a soft drifting curtain \u2014 one emotion is a single-hue wash, seven are seven legible curtains.',
  fragment: /* glsl */ `
// ── Soft Aurora ──────────────────────────────────────────────────────────
// Heavily-blurred vertical emotion curtains drifting over deep space.

// one parallax wash layer: soft vertical streaks that drift sideways
float auroraWash(vec2 uv, float speed, float freq, float seed){
  float x    = uv.x - uTime * speed;
  float sway = (fbm(vec2(uv.y * 1.3 + seed, uTime * 0.05 + seed)) - 0.5) * 0.30;
  float n    = fbm(vec2((x + sway) * freq, uv.y * 0.55 + seed * 2.0));
  return smoothstep(0.42, 0.97, n);
}

vec3 renderEffect(vec2 uv){
  float t = uTime;

  // deep space base, tinted by the weighted-average emotion
  vec3 space = mix(vec3(0.015, 0.02, 0.045), emBase() * 0.10, 0.6);

  // whisper of static cosmic dust (safe under reduced-motion freeze)
  vec2 sp    = aspectUv(uv) * 60.0;
  float star = smoothstep(0.992, 1.0, hash21(floor(sp))) * 0.22;
  space += vec3(star);

  // wavy band coordinate — emotions own vertical bands across the width
  float cx = sat(uv.x + (fbm(vec2(uv.y * 1.6, 4.0)) - 0.5) * 0.07);

  // two broad parallax wash layers, colored by the band gradient
  float wFar  = auroraWash(uv, 0.010, 2.2, 0.0);
  float wNear = auroraWash(uv, 0.024, 3.6, 7.3);
  vec3 washCol  = emGradient(cx)             * wFar  * 0.55;
  vec3 washCol2 = emGradient(sat(cx + 0.03)) * wNear * 0.38;

  // per-emotion curtain cores: uCount soft vertical sheets, width proportional to weight
  vec3 cores = vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float w      = emWeight(i);
    float center = acc + w * 0.5;
    acc += w;
    float halfW  = max(w * 0.55, 0.05);
    float sway   = sin(t * 0.12 + float(i) * 1.7) * 0.04
                 + (fbm(vec2(uv.y * 2.1 + float(i) * 3.0, t * 0.09)) - 0.5) * 0.10;
    float d      = (uv.x + sway - center) / halfW;
    float glow   = exp(-d * d * 1.6);
    float vert   = 0.55 + 0.45 * fbm(vec2(uv.y * 2.4 + float(i), t * 0.12 + float(i)));
    cores += emColor(i) * glow * vert;
  }

  // compose
  vec3 col = space + washCol + washCol2 + cores * 0.85;

  // soft luminance rolloff — rich mid-tones, never blinding white
  float lum = max(max(col.r, col.g), col.b);
  col *= 1.08 / (1.0 + lum * 0.55);

  // vertical vignette (darken extreme top & bottom)
  float vBot = smoothstep(0.0, 0.22, uv.y);
  float vTop = 1.0 - smoothstep(0.78, 1.0, uv.y);
  col *= 0.6 + 0.4 * (vBot * vTop);

  return clamp(col, 0.0, 1.0);
}
`,
}

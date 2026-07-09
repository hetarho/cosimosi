import type { BackgroundCandidate, EmotionBackground } from './emotion-field.ts'

// The GLSL contract every shader backdrop is written against.
//
// An effect supplies only the *body* of `vec3 renderEffect(vec2 uv)` (uv is 0..1,
// bottom-left origin). The host (shader-canvas.tsx) wraps it with GLSL_PREAMBLE
// (version, uniforms, the emotion accessors, and a small noise/color toolkit) and
// GLSL_EPILOGUE (main → gamma-safe write). This keeps every effect focused on the
// visual math and guarantees a consistent uniform convention so the same 13 shaders
// all react to the universe's emotions the same way.
//
// EMOTION CONTRACT — the whole point of these backdrops:
//   uCount            how many emotions the universe holds (1..13)
//   uColors[i]        emotion i's palette color (sRGB 0..1), primary-first
//   uWeights[i]       emotion i's normalized share (Σ = 1)
//   uBase             the weighted-average tint (a fallback tone)
// Effects MUST scale their composition by uCount — a 1-emotion universe reads as one
// dominant hue, a 7-emotion universe subdivides into seven legible regions. Always
// loop `for (int i = 0; i < 13; i++) { if (i >= uCount) break; ... }` — never index
// the arrays past uCount.
//
// REDUCED MOTION: the host freezes uTime at a developed phase and stops the animation
// loop, so writing `uTime` normally already yields a complete static frame. uReducedMotion
// (0/1) is provided for effects that also want to damp internal churn (e.g. grain).

export interface ShaderEffect {
  /** Stable id (kebab-case) — also the effect file name. */
  readonly key: string
  /** Short display name for the switcher. */
  readonly label: string
  /** One-line description of how emotions reshape it. */
  readonly blurb: string
  /** GLSL body of `vec3 renderEffect(vec2 uv)` (may define helpers above it). */
  readonly fragment: string
}

/** Shared GLSL header: version, uniforms, emotion accessors, and a noise/color toolkit. */
export const GLSL_PREAMBLE = /* glsl */ `#version 300 es
precision highp float;

uniform float uTime;         // seconds since mount (frozen under reduced motion)
uniform vec2  uResolution;   // drawing-buffer size in px
uniform float uReducedMotion;// 1.0 when the OS asks to reduce motion
uniform int   uCount;        // active emotion count, 1..13
uniform vec3  uColors[13];   // emotion colors, sRGB 0..1, primary-first
uniform float uWeights[13];  // normalized shares, Σ = 1
uniform vec3  uBase;         // weighted-average tint (fallback tone)

in  vec2 vUv;
out vec4 fragColor;

#define PI  3.14159265359
#define TAU 6.28318530718

float sat(float x){ return clamp(x, 0.0, 1.0); }
vec2  sat(vec2 x){ return clamp(x, 0.0, 1.0); }
mat2  rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Aspect-corrected, centered coords: y in [-1,1], x scaled by aspect ratio.
vec2 aspectUv(vec2 uv){
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  return p;
}

// ── emotion accessors ─────────────────────────────────────────────
int   emCount(){ return uCount; }
vec3  emColor(int i){ return uColors[i]; }
float emWeight(int i){ return uWeights[i]; }
vec3  emBase(){ return uBase; }

// Emotions laid end-to-end on [0,1] by weight; smooth blend across band centers.
vec3 emGradient(float t){
  if (uCount <= 0) return uBase;
  if (uCount == 1) return uColors[0];
  t = clamp(t, 0.0, 1.0);
  float mids[13];
  float acc = 0.0;
  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    mids[i] = acc + uWeights[i] * 0.5;
    acc += uWeights[i];
  }
  if (t <= mids[0]) return uColors[0];
  for (int i = 0; i < 12; i++){
    if (i + 1 >= uCount) break;
    if (t <= mids[i + 1]){
      float f = (t - mids[i]) / max(mids[i + 1] - mids[i], 1e-4);
      return mix(uColors[i], uColors[i + 1], smoothstep(0.0, 1.0, f));
    }
  }
  return uColors[uCount - 1];
}

// ── hashing / noise ───────────────────────────────────────────────
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; }
  return v;
}

// ── color ─────────────────────────────────────────────────────────
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
`

/** Shared GLSL footer: run the effect, guard NaNs, write an opaque color. */
export const GLSL_EPILOGUE = /* glsl */ `
void main(){
  vec3 col = renderEffect(vUv);
  col = clamp(col, 0.0, 1.0);
  if (any(isnan(col))) col = uBase;
  fragColor = vec4(col, 1.0);
}
`

/** Assemble a complete fragment shader from an effect's renderEffect body. */
export function composeFragment(body: string): string {
  return `${GLSL_PREAMBLE}\n${body}\n${GLSL_EPILOGUE}`
}

// Late import to avoid a cycle: shader-canvas imports the preamble from here.
// The candidate factory is defined in index.ts where ShaderCanvas is in scope.
export type { BackgroundCandidate, EmotionBackground }

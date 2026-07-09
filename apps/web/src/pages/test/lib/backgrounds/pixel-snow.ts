import type { ShaderEffect } from './shader-effect.ts'

// Pixel Snow — inspired by react-bits' PixelSnow shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const pixelSnow: ShaderEffect = {
  key: 'pixel-snow',
  label: 'Pixel Snow',
  blurb:
    'Each falling pixel-flake is tinted by a random active emotion, so 1 emotion drifts down as monochrome snow while 7 falls multicolored \u2014 and higher-weight emotions spawn denser, brighter flakes.',
  fragment: /* glsl */ `
const float PIXH = 130.0; // vertical pixel-grid resolution (chunky pixel look)

// Pick one active emotion for a flake from a per-flake hash into [0, uCount),
// returning its color and normalized weight. Emotion arrays are only ever
// indexed inside the guarded 0..13 loop, as the contract requires.
vec3 pickEmotion(float h, out float w) {
  int idx = int(floor(h * float(uCount)));
  idx = idx >= uCount ? uCount - 1 : idx;
  vec3 col = emBase();
  w = 1.0 / float(uCount);
  for (int i = 0; i < 13; i++) {
    if (i >= uCount) break;
    if (i == idx) { col = emColor(i); w = emWeight(i); }
  }
  return col;
}

// One parallax layer of falling pixel snow. p is aspect-corrected (x in [0,aspect],
// y in [0,1]). Each column/cell streams a flake downward via t; the flake is tinted
// by a per-cell emotion, and higher-weight emotions make denser, brighter flakes.
vec3 snowLayer(vec2 p, float scale, float speed, float radius, float bright, float seed, float t) {
  // gentle wind sway so columns don't fall dead-straight
  p.x += 0.045 * sin(t * 0.25 + p.y * 5.0 + seed);

  // grid space; adding t*speed to y scrolls the field downward => snow falls
  vec2 g = p * scale;
  g.y += t * speed;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;

  // per-cell hashes: presence, emotion selection, jitter, brightness variance
  float pe = hash21(cell + seed);
  float em = hash21(cell * 1.73 + vec2(seed * 2.3, 11.1));
  vec2 hj = hash22(cell + vec2(seed * 3.7, 5.2));

  float w;
  vec3 ec = pickEmotion(em, w);
  float rel = w * float(uCount); // 1.0 == average share

  // density scales with emotion weight (+ a touch with total emotion count)
  float dens = 0.16 * clamp(rel, 0.4, 1.8);
  dens *= mix(0.85, 1.15, (float(uCount) - 1.0) / 12.0);
  float present = step(pe, clamp(dens, 0.0, 0.9));

  // blocky flake: distance to jittered cell center (quantized by the pixel grid)
  vec2 d = f - (hj - 0.5) * 0.55;
  float r = length(d);
  // well-defined edge order (edge0 < edge1); invert for a bright-core falloff
  float flk = (1.0 - smoothstep(radius * 0.4, radius, r)) * present;

  float vary = 0.7 + 0.3 * hj.y;
  float fbright = bright * clamp(0.5 + 0.6 * rel, 0.4, 1.3) * vary;

  vec3 c = ec * flk * fbright;
  c += vec3(1.0) * (flk * flk) * 0.04 * present; // faint sparkle core
  return c;
}

vec3 renderEffect(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  // quantize to a fixed pixel grid so everything reads as pixel art
  vec2 pixv = vec2(PIXH * aspect, PIXH);
  vec2 uvp = (floor(uv * pixv) + 0.5) / pixv;
  vec2 p = vec2(uvp.x * aspect, uvp.y);

  float t = uTime;

  // deep night-sky base, faintly tinted by the emotion mean
  vec3 skyTop = vec3(0.015, 0.02, 0.055);
  vec3 skyBot = vec3(0.04, 0.05, 0.10);
  vec3 sky = mix(skyBot, skyTop, uvp.y);
  sky = mix(sky, sky * (0.5 + 0.7 * emBase()), 0.35);

  // barely-there nebular haze, colored across the emotion gradient
  float haze = fbm(p * 2.2 + vec2(0.0, t * 0.01));
  sky += emGradient(sat(haze)) * 0.03 * haze;

  vec3 col = sky;

  // three depth layers: far = small/slow/dim, near = large/fast/bright
  for (int L = 0; L < 3; L++) {
    float fl = float(L) / 2.0;
    float scale = mix(36.0, 16.0, fl);
    float speed = mix(1.2, 2.6, fl);
    float radius = mix(0.28, 0.40, fl);
    float bright = mix(0.5, 1.0, fl);
    float seed = 13.0 + float(L) * 27.0;
    col += snowLayer(p, scale, speed, radius, bright, seed, t);
  }

  // soft tonemap: rich mid-tones, colors kept, never blown to blinding white
  col = 1.0 - exp(-col * 1.25);

  // premium vignette
  vec2 pc = aspectUv(uv);
  col *= max(0.0, 1.0 - 0.14 * dot(pc, pc));

  return clamp(col, 0.0, 1.0);
}
`,
}

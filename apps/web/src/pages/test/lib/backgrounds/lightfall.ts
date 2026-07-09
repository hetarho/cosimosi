import type { ShaderEffect } from './shader-effect.ts'

// Lightfall — inspired by react-bits' Lightfall shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const lightfall: ShaderEffect = {
  key: 'lightfall',
  label: 'Lightfall',
  blurb:
    'uCount sets the number of descending light shafts (1 = a single central column, 7 = seven evenly-spaced beams); each shaft draws its hue from emColor(i) and its width and brightness from emWeight(i), scrolling downward with fbm flicker.',
  fragment: /* glsl */ `
// sqrt(tanh(.)) tonemap — rich mids, compressed highs, never full-white
vec3 lfTone(vec3 x){
  x = max(x - vec3(0.02, 0.03, 0.02), 0.0);
  vec3 e = exp(-2.0 * x);
  return sqrt((1.0 - e) / (1.0 + e));
}

vec3 renderEffect(vec2 uv){
  float cnt    = float(uCount);
  float scroll = uTime * 0.16;

  // deep base: emotion-tinted, lifting a touch toward the top of the frame
  vec3 col = emBase() * (0.05 + 0.06 * smoothstep(0.0, 1.0, uv.y));

  // faint colored source-haze along the top edge, one hue band per emotion
  col += emGradient(uv.x) * smoothstep(0.55, 1.0, uv.y) * 0.05;

  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float fi = float(i);
    float w  = emWeight(i);

    // spread beams evenly across x: 1 -> one central shaft, 7 -> seven columns
    float xi = (fi + 0.5) / cnt;
    xi += 0.015 * sin(uTime * 0.2 + fi * 1.7);   // gentle sway (static when frozen)
    float dx = uv.x - xi;

    // width & brightness both grow with the emotion's share
    float sigma = 0.10 / cnt + 0.34 * w;
    float core  = exp(-dx * dx / (2.0 * sigma * sigma));
    float wide  = sigma * 3.0;
    float halo  = exp(-dx * dx / (2.0 * wide * wide));

    // downward-scrolling flicker: tall soft bands + finer striations = falling light
    float sp    = 0.7 + 0.6 * hash11(fi + 1.0);
    float band  = fbm(vec2(uv.x * 2.5 + fi * 9.0, uv.y * 1.5 + scroll * sp));
    float fine  = fbm(vec2(dx * 16.0,             uv.y * 5.5 + scroll * sp * 1.8));
    float flick = (0.45 + 0.55 * band) * (0.7 + 0.3 * fine);

    // light originates above and tapers as it falls
    float vgrad = mix(0.35, 1.0, uv.y);

    vec3  c   = emColor(i);
    float amp = 0.45 + 0.8 * w;
    col += c * core * flick * vgrad * amp;
    col += c * halo * (0.3 + w) * vgrad * 0.18;
  }

  col = lfTone(col);

  // deep cosmic vignette so the frame edges stay calm
  vec2 p = aspectUv(uv);
  col *= max(1.0 - 0.22 * dot(p, p), 0.0);

  return clamp(col, 0.0, 1.0);
}
`,
}

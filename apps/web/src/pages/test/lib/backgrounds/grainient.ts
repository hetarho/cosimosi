import type { ShaderEffect } from './shader-effect.ts'

// Grainient — inspired by react-bits' Grainient shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const grainient: ShaderEffect = {
  key: 'grainient',
  label: 'Grainient',
  blurb:
    'Emotions are laid as smooth color stops along a slowly-rotating diagonal axis \u2014 uCount sets how many soft, weight-sized bands blend across the field \u2014 all beneath a fine animated film grain.',
  fragment: /* glsl */ `
// Grainient — a grainy editorial gradient.
// Emotions are laid as smooth color stops along a slowly-rotating diagonal
// axis; uCount controls how many legible regions appear, under fine film grain.

vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);                         // centered, aspect-corrected

  // slowly rotating diagonal sample axis
  float ang   = PI * 0.25 + uTime * 0.025;       // ~45deg, drifting very slowly
  vec2  dir   = vec2(cos(ang), sin(ang));
  vec2  perpv = vec2(-dir.y, dir.x);

  // gentle organic warp so the gradient breathes (soft, editorial)
  float flow = fbm(p * 1.1 + uTime * 0.04);
  vec2  pw = p + (flow - 0.5) * 0.18;
  pw.x += sin(p.y * 2.2 + uTime * 0.12) * 0.06;
  pw.y += sin(p.x * 1.7 - uTime * 0.09) * 0.05;

  // project onto the rotating axis -> gradient coordinate
  float axis = dot(pw, dir);
  float perp = dot(pw, perpv);
  float t = sat(axis * 0.55 + 0.5);              // multi-stop gradient across the field

  // emotions laid along the axis via the weighted ramp
  vec3 grad  = emGradient(t);
  vec3 grad2 = emGradient(sat(t + perp * 0.10)); // slight cross-axis blend for depth
  vec3 col = mix(grad, grad2, 0.35);

  // uCount restructure: one soft legible band per active emotion, sized by weight
  float cum   = 0.0;
  vec3  bands = vec3(0.0);
  float bw    = 0.0;
  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float w      = emWeight(i);
    float center = cum + w * 0.5;                // band center in [0,1]
    cum += w;
    float dd    = t - center;
    float sigma = max(w, 0.04) * 0.9;
    float band  = exp(-(dd * dd) / (2.0 * sigma * sigma));
    bands += emColor(i) * band * w;
    bw    += band * w;
  }
  bands /= max(bw, 0.001);
  col = mix(col, bands, 0.45 * sat(bw * 4.0));   // regions get more legible as count rises

  // premium deep tone: rich mid-tones, never blinding
  col = mix(emBase(), col, 0.88);                // cohere toward the base tint
  col = pow(max(col, 0.0), vec3(1.18));          // deepen the mids
  col *= 0.80;
  col *= 0.90 + 0.14 * sat(perp * 0.5 + 0.5);    // soft editorial cross-light
  col *= 1.0 - 0.26 * dot(p, p);                 // gentle vignette

  // animated film grain on fragCoord+time, damped under reduced motion
  vec2  px = uv * uResolution;
  float g  = hash21(px + vec2(uTime * 47.0, uTime * 31.0));
  float gAmp = mix(0.055, 0.012, uReducedMotion);
  col += (g - 0.5) * gAmp;

  return clamp(col, 0.0, 1.0);
}
`,
}

import type { ShaderEffect } from './shader-effect.ts'

// Ripple Grid — inspired by react-bits' RippleGrid shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const rippleGrid: ShaderEffect = {
  key: 'ripple-grid',
  label: 'Ripple Grid',
  blurb:
    "uCount sets how many concentric color rings the ripple travels through \u2014 one emotion is a single dominant pulsing halo, more emotions split the field into that many rings each cycling through the palette, while the warped gridlines pick up the local ring's emotion tint.",
  fragment: /* glsl */ `
vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);                 // centered, aspect-corrected (y in [-1,1])
  float dist = length(p);
  float rings = float(max(uCount, 1));   // distinct color rings scale with active emotions (guarded >0)

  // one calm radial ripple field emanating from center
  float func = sin(TAU * dist * rings - uTime * 0.6);
  float ripple = func * 0.5 + 0.5;       // 0..1 ring brightness

  // grid coordinates warped by the ripple (the "ripple grid" essence)
  vec2 warp = p + p * func * 0.10;
  vec2 g = warp * 7.0;
  vec2 fr = fract(g);
  vec2 dL = 0.5 - abs(fr - 0.5);         // 0 at a gridline, 0.5 at cell center
  float lineDist = min(dL.x, dL.y);
  float line = smoothstep(0.05, 0.0, lineDist);
  float glow = smoothstep(0.28, 0.0, lineDist) * 0.35;

  // per-ring emotion color: successive rings cycle through the emotions
  float band = floor(dist * rings);
  vec3 ringCol = emGradient(fract(band / rings));
  // continuous local emotion, used to tint the gridlines
  vec3 localCol = emGradient(fract(dist * rings));

  // compose over a deep base
  vec3 col = emBase() * 0.07;
  col += ringCol * (0.14 + 0.42 * ripple);                        // glowing concentric rings
  col += localCol * (line * 0.75 + glow) * (0.7 + 0.5 * ripple);  // gridlines tinted + pulsing

  // faint nebular depth (freezes cleanly under reduced motion)
  float neb = fbm(p * 1.6 + vec2(0.0, uTime * 0.03));
  col += localCol * neb * 0.05;

  // radial fade / gentle vignette — keep it a deep cosmic backdrop
  float fade = exp(-1.15 * dist * dist);
  col *= 0.35 + 0.65 * fade;

  // hue-preserving highlight rolloff — rich color, never blinding white
  float m = max(col.r, max(col.g, col.b));
  col *= 1.0 / (1.0 + 0.4 * m);

  return clamp(col, 0.0, 1.0);
}
`,
}

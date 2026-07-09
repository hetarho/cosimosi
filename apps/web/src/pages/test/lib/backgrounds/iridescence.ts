import type { ShaderEffect } from './shader-effect.ts'

// Iridescence — inspired by react-bits' Iridescence shader.
// The 8-iteration feedback loop produces slick, shifting iridescent waves. The
// original tints everything by one flat color; here the shimmer is tinted by the
// emotion palette via emGradient, so a 1-emotion universe reads as one iridescent
// tone and a 7-emotion universe fans into seven shifting hue bands.
export const iridescence: ShaderEffect = {
  key: 'iridescence',
  label: 'Iridescence',
  blurb: 'Shifting oil-slick waves — hue bands fan out with each added emotion.',
  fragment: /* glsl */ `
vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);
  float t = uTime * 0.4;
  float d = -t;
  float a = 0.0;
  for (int i = 0; i < 8; i++){
    float fi = float(i);
    a += cos(fi - d - a * p.x);
    d += sin(p.y * fi + a);
  }
  d += t;
  vec3 w = vec3(cos(p * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  w = cos(w * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
  // Pattern-driven axis into the emotion gradient: more emotions → more hue bands.
  float axis = fract(0.5 * (w.x + w.y) + 0.04 * (a + d));
  vec3 tint = emGradient(axis);
  vec3 col = mix(w, w * tint * 1.7, 0.85);
  col *= 1.0 - 0.18 * dot(p, p);
  return col;
}
`,
}

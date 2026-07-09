import type { ShaderEffect } from './shader-effect.ts'

// Floating Lines — inspired by react-bits' FloatingLines shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const floatingLines: ShaderEffect = {
  key: 'floating-lines',
  label: 'Floating Lines',
  blurb:
    'Cumulative emotion weights slice the screen into uCount vertically-stacked bands of drifting wavy horizontal strands, each band tinted by its emotion \u2014 one emotion fills the field as a single hue, seven split it into seven luminous colored line-bands sized by weight.',
  fragment: /* glsl */ `
// ---- Floating Lines (emotion port) ----
const int LINES = 6;              // wavy strands per emotion band

// one luminous wavy horizontal strand -> glow contribution at pixel (px,py)
float strandGlow(float px, float py, float baseY, float amp,
                 float freq, float phase, float scroll, float thick){
  float wv  = sin((px + scroll) * freq + phase) * amp;
  wv += (fbm(vec2((px + scroll) * 0.7 + phase, baseY * 5.0)) - 0.5) * amp * 1.4;
  float d    = abs(py - (baseY + wv));
  float core = thick / (d + thick);
  float halo = (thick * 5.0) / (d + thick * 5.0);
  return core + halo * 0.22;
}

vec3 renderEffect(vec2 uv){
  vec2  ap = aspectUv(uv);        // ap.x aspect-scaled horizontal drift axis
  float px = ap.x;
  float py = uv.y;                // 0..1 vertical -> band stacking
  float t  = uTime;

  vec3  col = vec3(0.0);
  float cum = 0.0;                // cumulative weight -> band boundaries

  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float w  = emWeight(i);       // band height share
    vec3  ec = emColor(i);        // band tint
    float lo = cum;
    float hi = cum + w;
    cum = hi;

    for (int k = 0; k < LINES; k++){
      float fk     = float(k);
      float frac   = (fk + 0.5) / float(LINES);
      float baseY  = mix(lo, hi, frac);
      baseY += 0.03 * w * sin(t * 0.3 + fk * 1.3 + float(i));
      float amp    = w * 0.16 * (0.55 + 0.45 * sin(t * 0.22 + fk + float(i) * 0.7));
      float freq   = 3.0 + fk * 0.7 + float(i) * 0.4;
      float phase  = fk * 1.7 + float(i) * 0.9;
      float dir    = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
      float scroll = t * (0.05 + 0.02 * fk) * dir;
      float thick  = 0.0045 + 0.004 * w;
      col += ec * strandGlow(px, py, baseY, amp, freq, phase, scroll, thick);
    }
  }

  vec3 bg = emBase() * 0.05 + 0.012;   // deep cosmic floor, never fully black
  col = bg + col * 0.5;
  col = 1.0 - exp(-col * 1.35);        // soft tonemap -> luminous, not blinding
  col *= 1.0 - 0.10 * dot(ap, ap);     // gentle vignette for depth
  return max(col, 0.0);
}
`,
}

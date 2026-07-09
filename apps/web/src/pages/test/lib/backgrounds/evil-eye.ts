import type { ShaderEffect } from './shader-effect.ts'

// Evil Eye — inspired by react-bits' EvilEye shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const evilEye: ShaderEffect = {
  key: 'evil-eye',
  label: 'Evil Eye',
  blurb:
    'uCount is the number of concentric iris rings \u2014 1 = a single glowing hue, 7 = seven nested colored bands \u2014 each ring emColor(i) sized by emWeight(i), wrapped in flame-fbm fibers around a deep emBase pupil and a luminous limbal rim.',
  fragment: /* glsl */ `
// ---- Evil Eye: a glowing cosmic iris built from concentric emotion rings ----
const float EDGE    = 0.035;
const float R_PUPIL = 0.15;
const float R_IRIS  = 0.92;

// fbm sampled seamlessly around the ring: high angular frequency (fibers),
// slow along the radius, scrolled over time -> flame-like iris strands.
float fiberFbm(float ang, float rad, float freq, float drift){
  float a  = ang / TAU + 0.5;                  // 0..1 around the circle
  float f  = fract(a);
  float na = fbm(vec2(f * freq + drift, rad));
  float nb = fbm(vec2((f - 1.0) * freq + drift, rad));
  return mix(na, nb, f);                        // crossfade hides the angular seam
}

vec3 renderEffect(vec2 uv){
  vec2  p   = aspectUv(uv);                     // centered, y in [-1,1]
  float r   = length(p);
  float ang = atan(p.y, p.x);                   // -PI..PI
  float t   = uTime;

  // flame fibers: high freq around the angle, slow along radius, scrolling outward
  float fine  = fiberFbm(ang, r * 0.6 - t * 0.5, 7.0, 0.0);
  float broad = fiberFbm(ang, r * 0.9 - t * 0.3, 4.0, 0.0);
  float flame = fine * 0.6 + broad * 0.4;

  // flame warps the radial coordinate so rings and rim ripple around the angle
  float rd = r + (flame - 0.5) * 0.10;

  // normalized position across the iris band: 0 at the pupil, 1 at the limbus
  float s = sat((rd - R_PUPIL) / (R_IRIS - R_PUPIL));

  // ---- concentric emotion rings: ring i = emColor(i), thickness = emWeight(i) ----
  vec3  iris      = emColor(0);
  vec3  outerCol  = emColor(0);
  float ringLines = 0.0;
  float acc       = 0.0;
  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    iris      = mix(iris, emColor(i), smoothstep(acc - EDGE, acc + EDGE, s));
    outerCol  = emColor(i);
    acc      += emWeight(i);
    ringLines += 1.0 - smoothstep(0.0, 0.05, abs(s - acc));   // filament at each boundary
  }
  ringLines = min(ringLines, 1.0);

  // ---- masks ----
  float eyeMask   = 1.0 - smoothstep(R_IRIS - 0.14, R_IRIS, rd);
  float pupilMask = 1.0 - smoothstep(R_PUPIL - 0.05, R_PUPIL, rd);
  float irisMask  = eyeMask * (1.0 - pupilMask);

  // ---- fibrous iris glow (brightest mid-iris, fibers from the flame field) ----
  float bandShape = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.8, 1.0, s));
  float irisGlow  = (0.45 + 0.7 * flame) * (0.5 + 0.55 * bandShape);

  // ---- compose ----
  vec3 col = emBase() * 0.06;                                   // dark sclera tint
  col = mix(col, iris * irisGlow, irisMask);                    // iris body
  col += iris * ringLines * 0.22 * irisMask;                    // luminous ring filaments
  float rim = 1.0 - smoothstep(0.0, 0.09, abs(rd - R_IRIS));    // limbal ring
  col += outerCol * rim * 0.7 * (0.55 + 0.45 * flame);
  float core = exp(-max(rd - R_PUPIL, 0.0) * 8.0) * (1.0 - pupilMask);
  col += iris * core * 0.15;                                    // inner throw-light near pupil
  col = mix(col, emBase() * 0.18, pupilMask);                   // deep pupil well

  // ---- vignette to deep space at the edges ----
  float vign = 1.0 - smoothstep(0.35, 1.35, r);
  col *= mix(0.32, 1.0, vign);
  col += emBase() * 0.02 * vign;

  // gentle highlight rolloff -> rich cosmic mid-tones, never blinding white
  col = col / (1.0 + col * 0.3) * 1.15;
  return col;
}
`,
}

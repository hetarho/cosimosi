import type { ShaderEffect } from './shader-effect.ts'

// Prismatic Burst — inspired by react-bits' PrismaticBurst shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const prismaticBurst: ShaderEffect = {
  key: 'prismatic-burst',
  label: 'Prismatic Burst',
  blurb:
    'uCount sets both the number of angular color sectors (emGradient wrapped around the center) and the ray-strand count, so 1 emotion is a single-hue burst and 7 fans into a rotating seven-sector prism.',
  fragment: /* glsl */ `
// Prismatic Burst — a radial spectral ray burst.
// The palette wraps around the center (emGradient over the angle), so uCount
// becomes the number of angular color sectors; ray strands scale with uCount too.
vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);
  float r   = length(p) + 1e-4;
  float ang = atan(p.y, p.x);                 // -PI..PI

  float t = uTime * 0.12;

  // slow global rotation of the whole prism
  float aRot = ang + t * TAU;

  // palette wraps the burst; tiny radial shear => prismatic dispersion
  float disp    = r * 0.18 - uTime * 0.03;
  float sectorT = fract(aRot / TAU + disp);
  vec3  rayCol  = emGradient(sectorT);

  // rotating ray streaks — more emotions -> more strands
  int   rc  = uCount * 3;                      // 3..39 rays
  float frc = float(rc);
  float s1  = 0.5 + 0.5 * sin(ang * frc       + uTime * 0.6);
  float s2  = 0.5 + 0.5 * sin(ang * frc * 2.0 - uTime * 0.9 + 1.7);
  float streak = pow(s1, 5.0) * 0.7 + pow(s2, 8.0) * 0.5;

  // filamentary break-up so rays read as light shafts, not clean spokes
  float fil = fbm(vec2(ang * 2.2, r * 3.0) + vec2(0.0, uTime * 0.15));
  streak *= 0.55 + 0.75 * fil;

  // radial profile: hot core -> deep outer field
  float rays = streak / (0.25 + r * 3.2);      // rays fade outward
  float core = 0.7 * exp(-r * 6.0);            // bright hot core
  float halo = 0.10 / (0.18 + r * r * 2.5);    // soft surrounding halo

  // deep cosmic bed with faint nebular drift (keeps the periphery alive, not flat)
  float neb = fbm(p * 1.5 + vec2(0.0, uTime * 0.05));
  vec3  deep = emBase() * (0.04 + 0.05 * neb);

  // compose
  vec3 col = vec3(0.0);
  col += rayCol   * rays * 1.25;               // colored prismatic rays
  col += emBase() * core;                      // hot core (weighted-avg tint)
  col += rayCol   * halo * 0.9;                // colored halo
  col += deep;

  // vignette keeps the periphery deep & premium
  col *= 1.0 - 0.35 * sat(r * 0.7);

  // very subtle grain (uTime frozen under reduced motion => static)
  float g = hash21(p * uResolution.xy * 0.5 + vec2(uTime));
  col += (g - 0.5) * 0.02 * (1.0 - uReducedMotion);

  // soft rolloff: rich mid-tones, never blinding white
  col = col / (1.0 + col * 0.8);
  return clamp(col, 0.0, 1.0);
}
`,
}

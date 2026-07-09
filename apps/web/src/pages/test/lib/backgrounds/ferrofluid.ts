import type { ShaderEffect } from './shader-effect.ts'

// Ferrofluid — inspired by react-bits' Ferrofluid shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const ferrofluid: ShaderEffect = {
  key: 'ferrofluid',
  label: 'Ferrofluid',
  blurb:
    'Each emotion becomes a magnetic black-fluid blob (radius ~ sqrt of its weight, tinted its color) drifting on an fbm flow; they smooth-min merge into more colored lobes as the count rises, glossed by a steep iridescent rim.',
  fragment: /* glsl */ `
// --- Ferrofluid port: magnetic black-fluid metaballs, one per emotion ---

// polynomial smooth-min (metaball merge) for signed distances
float sminF(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);          // centered, y in [-1,1]
  float t = uTime * 0.15;

  // ferrofluid flow field — slow turbulent drift that warps the whole body
  vec2 flow = vec2(
    fbm(p * 1.4 + vec2(0.0,  t)),
    fbm(p * 1.4 + vec2(5.2, -t))
  );
  vec2 pw = p + (flow - 0.5) * 0.6;   // warped sample position

  // merge emotion blobs into one metaball field
  float k = 0.35;                 // fluidity / merge softness
  float d = 1000.0;               // merged signed distance
  vec3  colSum = vec3(0.0);
  float wSum = 0.0;

  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float fi = float(i);

    // deterministic drift: even ring spread scaled by count, each lobe on its own orbit
    float ang  = t * (0.6 + hash11(fi) * 0.8) + fi * TAU / float(uCount);
    float ring = (uCount > 1) ? 0.62 : 0.0;
    vec2  base = vec2(cos(ang), sin(ang)) * ring * (0.5 + 0.5 * hash11(fi + 7.0));
    vec2  wob  = (hash22(vec2(fi * 1.37 + 0.5, fi * 2.11 + 1.3)) - 0.5)
                 * 0.4 * sin(t * 0.7 + fi);
    vec2  c    = base + wob;

    float r  = 0.16 + 0.5 * sqrt(max(emWeight(i), 0.0));   // radius ~ sqrt(weight)
    float di = length(pw - c) - r;                          // blob SDF
    d = sminF(d, di, k);

    float w = exp(-max(di, -0.3) * 6.0);   // color weight — interior dominates
    colSum += emColor(i) * w;
    wSum   += w;
  }

  vec3 blobCol = (wSum > 0.0) ? colSum / wSum : emBase();

  // near-black ferro base with a faint colored nebula so empty space keeps depth
  float amb = fbm(p * 1.8 + vec2(t * 0.3, -t * 0.2));
  vec3  ferro = mix(vec3(0.010, 0.012, 0.020), emBase() * 0.10, 0.5);
  vec3  base  = ferro + emGradient(sat(amb)) * 0.06;

  // fluid body — deep, glossy, tinted dark
  float body   = sat(-d / 0.25);
  float glossy = smoothstep(0.0, 1.0, body);
  vec3  col = base;
  col = mix(col, blobCol * 0.40, glossy);          // colored dark fill
  col += blobCol * 0.10 * pow(body, 3.0);          // inner sheen

  // outer colored halo (glow) hugging the surface
  float glow = exp(-max(d, 0.0) * 3.5);
  col += blobCol * glow * 0.18;

  // bright iridescent RIM where the field surface is steep (d near 0)
  float rim  = exp(-(d * d) / (0.03 * 0.03));
  float irid = fract(0.5 + 0.5 * (flow.x - flow.y) + 0.3 * (p.x + p.y));
  vec3  iridCol = emGradient(irid);
  col += rim * (blobCol * 0.5 + iridCol * 0.85) * 1.4;

  // cosmic vignette + filmic shoulder so highlights stay chromatic, never blinding white
  col *= 1.0 - 0.25 * dot(p, p);
  return 1.0 - exp(-col * 1.2);
}
`,
}

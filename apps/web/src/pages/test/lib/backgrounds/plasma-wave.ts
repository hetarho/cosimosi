import type { ShaderEffect } from './shader-effect.ts'

// Plasma Wave — inspired by react-bits' PlasmaWave shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const plasmaWave: ShaderEffect = {
  key: 'plasma-wave',
  label: 'Plasma Wave',
  blurb:
    'Each active emotion adds a weaving glowing plasma strand in its own hue, so the field goes from one dominant band to many interfering lanes as the count rises, with uCount also thickening the interference banding.',
  fragment: /* glsl */ `
// --- Plasma Wave (react-bits) adapted to the emotion contract ---
// The reference raymarches two wobbling wave strands and colors each pixel by
// which strand is nearest, glowing over a dark field. Here the dual strands are
// generalized to N weaving emotion lanes: strand count = active emotions, each
// carries its own hue, and uCount also scales the interference banding.

float pwGlow(float d, float w){
  return w / (d * d + w);   // soft Lorentzian falloff around a wave line
}

vec3 renderEffect(vec2 uv){
  vec2 p = aspectUv(uv);              // y in [-1,1], aspect-corrected x
  float t = uTime * 0.30;

  // coherent domain warp so lanes flow like plasma while staying legible
  vec2 q = p;
  q.y += (fbm(p * 1.3 + vec2(t * 0.20, -t * 0.13)) - 0.5) * 0.40;
  q.x += (fbm(p * 1.0 - vec2(t * 0.10,  t * 0.22)) - 0.5) * 0.30;

  // --- weaving emotion strands (the dual-wave essence, generalized to N) ---
  vec3  strandCol = vec3(0.0);
  float glowSum   = 0.0;

  float spacing = 1.50 / max(float(uCount), 1.0);
  float halfN   = 0.5 * (float(uCount) - 1.0);

  for (int i = 0; i < 13; i++){
    if (i >= uCount) break;
    float fi = float(i);
    float wt = emWeight(i);

    float center = (fi - halfN) * spacing;                 // vertical lane
    float freq   = 0.90 + fi * 0.25;                       // gentle per-strand bend
    float bend   = 0.07 + 0.012 * fi;
    float wobA   = sin(q.x * freq + t * (0.80 + 0.18 * fi) + fi * 1.30) * bend;
    float wobB   = cos(q.x * (freq * 0.55) - t * 0.60 + fi * 0.70) * 0.07;
    float yLine  = center + wobA + wobB;

    float d = q.y - yLine;
    float g = pwGlow(d, 0.020 + 0.030 * wt);               // heavier emotion = fatter lane
    float contrib = g * (0.35 + 1.25 * wt);

    strandCol += emColor(i) * contrib;
    glowSum   += contrib;
  }

  // proximity-weighted hue; brightness saturates so overlaps never blow to white
  vec3  hue       = strandCol / max(glowSum, 0.001);
  float intensity = glowSum / (1.0 + glowSum);

  // plasma interference banding — more emotions => more lobes / color transitions
  float bandFreq = 1.5 + float(uCount) * 0.60;
  float inter = sin(q.x * bandFreq + t)
              + cos(q.y * (bandFreq * 0.5) - t * 0.60)
              + (fbm(q * 2.0 + vec2(t * 0.15, 0.0)) * 2.0 - 1.0);
  float band  = 0.72 + 0.28 * (0.5 + 0.5 * sin(inter * PI));
  intensity  *= band;

  vec3 col = hue * intensity;

  // dim emotion-gradient wash fills the dark field between the strands
  float axis = fract(inter * 0.20 + 0.5);
  col += emGradient(axis) * 0.10 * (1.0 - intensity);

  // deep base tone + vignette for a calm cosmic backdrop
  col += emBase() * 0.03;
  col *= 1.0 - 0.22 * dot(p, p);

  // gentle tone shaping: rich luminous mid-tones, never blinding
  col  = col * 1.35;
  col  = col / (col + 0.60);
  col  = pow(max(col, 0.0), vec3(0.92));

  return clamp(col, 0.0, 1.0);
}
`,
}

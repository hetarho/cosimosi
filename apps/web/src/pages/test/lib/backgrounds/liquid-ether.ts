import type { ShaderEffect } from './shader-effect.ts'

// Liquid Ether — inspired by react-bits' LiquidEther shader, re-authored against the
// emotion contract (see shader-effect.ts). Emotion count reshapes the composition.
export const liquidEther: ShaderEffect = {
  key: 'liquid-ether',
  label: 'Liquid Ether',
  blurb:
    'uCount multiplies the hue-vein frequency and widens the emGradient palette, so one emotion marbles as a single glossy chrome hue while seven braid into many interleaved ink veins.',
  fragment: /* glsl */ `
// ---- Liquid Ether: domain-warped fbm marble ---------------------------
// Slow, viscous liquid-chrome flow. A double fbm warp folds the field into
// marbled veins; the warped value indexes emGradient so palette hues run
// and braid like ink dropped in water. No fluid sim, no interaction.
float fbmField(vec2 p, float t, out vec2 warp){
    // first warp: coarse churn, drifted slowly by time
    vec2 q = vec2(fbm(p + vec2(0.0, 1.0) * t),
                  fbm(p + vec2(5.2, 1.3) - vec2(1.0, 0.0) * t));
    // second warp: folds the flow into marbled veins
    vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2)),
                  fbm(p + 3.5 * q + vec2(8.3, 2.8)));
    warp = r;
    return fbm(p + 3.5 * r);
}

vec3 renderEffect(vec2 uv){
    vec2 c = aspectUv(uv);
    vec2 p = c * 1.4;
    float t = uTime * 0.05;
    p += vec2(0.10, -0.06) * t;              // slow bulk drift

    // marbled liquid field + its warp vector
    vec2 warp;
    float f = fbmField(p, t, warp);

    // finite-difference normal for glossy liquid-chrome specular
    float e = 0.03;
    vec2 dmp;
    float fx = fbmField(p + vec2(e, 0.0), t, dmp);
    float fy = fbmField(p + vec2(0.0, e), t, dmp);
    vec3 n = normalize(vec3(f - fx, f - fy, e * 5.0));

    // hue braiding: uCount sets how many veins cycle the palette
    float veins = 0.6 + float(uCount) * 0.55;
    float raw = f * veins + 0.35 * warp.x + 0.15 * warp.y + 0.10 * t;
    float axis = abs(fract(raw) * 2.0 - 1.0); // smooth reflecting ink bands
    vec3 flow = emGradient(axis);

    // viscous depth shading: troughs sink into a deep base tint
    float depth = sat(0.30 + 0.75 * f);
    vec3 col = mix(emBase() * 0.10, flow, depth);
    col *= 0.55 + 0.55 * f;

    // glossy chrome highlights, concentrated on the ridges
    vec3 L = normalize(vec3(0.35, 0.65, 0.7));
    float d = sat(dot(n, L));
    float specHi = pow(d, 42.0);
    float specLo = pow(d, 9.0);
    float ridge = smoothstep(0.45, 0.9, f);
    col += (0.22 * specHi + 0.06 * specLo) * (0.5 + 0.5 * flow) * (0.4 + 0.6 * ridge);

    // premium cosmic falloff + soft rolloff so it never blows to white
    float vig = max(0.0, 1.0 - 0.28 * dot(c, c)); // clamp: aspect x can push dot(c,c)>3.5
    col *= vig;
    col = col / (1.0 + 0.30 * col);
    return col;
}
`,
}

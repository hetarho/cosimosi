// Procedural fluid "aurora" material (R3F WebGPU/TSL) — extracted so it can be reused without
// dragging a component in (react-refresh: component files export only components). A two-pass
// domain-warped fbm: one fbm warps the uv, a second fbm sampled at the warped coordinate mixes the
// palette into soft, irregular flowing bands.
//
// frozen-time idiom (constitution §3.1 / project memory): motion is driven by a MANUAL `uTime`
// uniform bumped via the returned `update(t)` — NOT three's built-in TSL `time` node (BloomPass's
// RenderPipeline doesn't advance it). Consumers own when to call update (reduced-motion → never).
//
// Used by FluidGradient (fullscreen clip-space quad, legacy sign-in/invite backdrop) and CosmosScene
// (spec 43 — reused on regular planes as soft back nebula + DARK drifting front clouds; theme palette
// + brightness make it a dim, deep-space background rather than a bright wash).
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  vec2,
  vec3,
  float,
  uniform,
  uv,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  length,
  mx_fractal_noise_float,
} from 'three/tsl'

/** 6-slot fluid palette: 깊은 base → 4 중간 톤(c1..c4) → 밝은 하이라이트(hi). 테마별로 갈아끼운다. */
export interface CosmosPalette {
  base: string
  c1: string
  c2: string
  c3: string
  c4: string
  hi: string
}

// 기본(vast) 팔레트 — 깊은 violet base, 소프트 magenta/pink/violet/lavender, 따뜻한 cream 하이라이트.
const DEFAULT_PALETTE: CosmosPalette = {
  base: '#0b0b1c',
  c1: '#3a2b6b',
  c2: '#8d5bd6',
  c3: '#d479c6',
  c4: '#b9a7ef',
  hi: '#f3e6d0',
}

/** 테마 키 — appearance 엔티티의 Theme와 구조적으로 같지만(문자열 유니온) 이 모듈은 엔티티를 import하지
 *  않는다(디커플드 유지). 소비처가 자기 theme을 그대로 넘긴다. */
export type CosmosThemeKey = 'vast' | 'lively' | 'calm'

// 테마별 fluid 팔레트(themes.ts의 색 성격을 따른다): vast=인디고 violet, lively=따뜻한 자홍, calm=청록.
const THEME_PALETTES: Record<CosmosThemeKey, CosmosPalette> = {
  vast: DEFAULT_PALETTE,
  lively: { base: '#120617', c1: '#4a1f3a', c2: '#c75ba0', c3: '#ff7a8f', c4: '#ffb27a', hi: '#ffe6c8' },
  calm: { base: '#04140f', c1: '#0e3b38', c2: '#1d9e75', c3: '#3fd6b5', c4: '#9fe6cf', hi: '#e6f3ea' },
}

/** 테마 → fluid 팔레트. 소비처(사인인·초대·랜딩)가 appearance theme을 넘겨 배경색을 테마에 맞춘다. */
export const paletteForTheme = (t: CosmosThemeKey): CosmosPalette => THEME_PALETTES[t] ?? DEFAULT_PALETTE

/** fluid 머티리얼 옵션.
 *  - `palette`: 테마별 6색(기본 vast).
 *  - `brightness`: 컬러 전체 배율(기본 1; 배경은 <1로 어둡게 — "딥스페이스").
 *  - `octaves`: fbm 옥타브(기본 3, `VALUES.cosmos.fluidOctaves`).
 *  - `radial`: 중심→가장자리 원형 소프트 페이드(투명) — 박스 경계 숨김.
 *  - `dark`: **어두운 구름**(normal alpha, 가산 아님) — 별 *앞*에 깔아 안개처럼 가린다. radial 페이드 + 노이즈
 *    패치 opacity. (foreground와 배타 — dark가 우선.)
 *  - `foreground`: (구) 밝은 additive wisp. 어두운 구름(dark)으로 대체 권장.
 */
export interface FluidMaterialOptions {
  palette?: CosmosPalette
  brightness?: number
  octaves?: number
  radial?: boolean
  dark?: boolean
  foreground?: boolean
}

/** The TSL aurora plane material + a manual-time `update(t)` (frozen-time idiom). */
export function buildFluidMaterial(opts?: FluidMaterialOptions) {
  const oct = opts?.octaves ?? 3
  const pal = opts?.palette ?? DEFAULT_PALETTE
  const bMul = opts?.brightness ?? 1
  const uTime = uniform(0)
  const t = float(uTime as never)
  const update = (time: number) => {
    uTime.value = time
  }

  // Palette as linear-space colors (flat renderer → no tone mapping; mirrors halo.ts uniform Color).
  const cBase = vec3(uniform(new THREE.Color(pal.base)) as never)
  const cC1 = vec3(uniform(new THREE.Color(pal.c1)) as never)
  const cC2 = vec3(uniform(new THREE.Color(pal.c2)) as never)
  const cC3 = vec3(uniform(new THREE.Color(pal.c3)) as never)
  const cC4 = vec3(uniform(new THREE.Color(pal.c4)) as never)
  const cHi = vec3(uniform(new THREE.Color(pal.hi)) as never)

  // uv() is 0..1 across the quad. Bias toward landscape so the bands read horizontally; the exact
  // aspect doesn't matter for an organic cloud, so a fixed stretch keeps it resolution-independent.
  const p = vec2(uv().x.mul(1.6), uv().y.mul(1.0))

  // Slow flow — the whole field drifts up/right while the warp field itself evolves, so the pattern
  // churns instead of merely sliding (the forms.ts aurora trick).
  const flow = vec2(t.mul(0.012), t.mul(-0.02))

  // Pass 1 — domain warp. Two fbm samples form a 2D offset that bends the coordinate grid.
  const wx = mx_fractal_noise_float(vec3(p.add(flow), t.mul(0.03)), oct, 2.0, 0.5)
  const wy = mx_fractal_noise_float(vec3(p.add(flow).add(vec2(5.2, 1.3)), t.mul(0.04)), oct, 2.0, 0.5)
  const warped = p.add(vec2(wx, wy).mul(0.6))

  // Pass 2 — sample the field at the warped coordinate. n drives the main palette ramp; n2 (finer,
  // offset) breaks up the bands so blends stay irregular. Both remapped from [-1,1] to [0,1].
  const n = mx_fractal_noise_float(vec3(warped, t.mul(0.02)), oct, 2.0, 0.55).mul(0.5).add(0.5)
  const n2 = mx_fractal_noise_float(vec3(warped.mul(1.9).add(vec2(11.7, 3.1)), t.mul(0.05)), oct, 2.0, 0.5)
    .mul(0.5)
    .add(0.5)

  const m = new MeshBasicNodeMaterial()
  m.toneMapped = false
  m.depthWrite = false
  m.depthTest = false

  // 중심→가장자리 원형 소프트 페이드(박스 경계 숨김). dark/radial/foreground 공통.
  const edge = smoothstep(float(1.0), float(0.35), length(uv().sub(0.5)).mul(2.0))

  if (opts?.dark) {
    // 어두운 구름 — 별 앞을 안개처럼 지나며 가린다(normal alpha, 가산 아님). 색은 깊은 base보다 더 어둡게,
    // opacity는 노이즈가 높은 곳만(드문드문한 짙은 덩어리)으로 별을 부분적으로만 덮는다.
    m.colorNode = cBase.mul(0.5)
    m.transparent = true
    const patch = smoothstep(float(0.5), float(0.85), n.mul(n2.mul(0.5).add(0.6)))
    m.opacityNode = edge.mul(patch).mul(0.72)
    return { material: m, update }
  }

  // Layer the palette: deep base → c1 → c2 → c3 → c4, each fading in over a noise band via smoothstep
  // so boundaries are soft and overlapping (a mesh-gradient look). brightness multiplier dims it for a
  // deep-space backdrop.
  let col = mix(cBase, cC1, smoothstep(float(0.15), float(0.5), n))
  col = mix(col, cC2, smoothstep(float(0.4), float(0.7), n))
  col = mix(col, cC3, smoothstep(float(0.6), float(0.85), n.mul(n2.mul(0.6).add(0.7))))
  col = mix(col, cC4, smoothstep(float(0.78), float(0.98), n2))

  // Sparse highlight only where both fields peak — a few drifting bright wisps, not a wash.
  const hi = pow(clamp(n.mul(n2), float(0), float(1)), float(3.0))
  const shimmer = sin(t.mul(0.4).add(n.mul(6.28))).mul(0.15).add(0.85)
  col = mix(col, cHi, hi.mul(shimmer).mul(0.5))
  col = col.mul(bMul)

  m.colorNode = opts?.foreground ? col.mul(0.7) : col
  if (opts?.foreground) m.blending = THREE.AdditiveBlending
  if (opts?.foreground || opts?.radial) {
    m.transparent = true
    const base = opts?.foreground
      ? pow(clamp(n.mul(n2), float(0), float(1)), float(2.0)).mul(0.55)
      : float(0.9)
    m.opacityNode = edge.mul(base)
  }
  return { material: m, update }
}

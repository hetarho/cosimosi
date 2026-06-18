// 자아("나") 별의 형태(form) TSL 빌더(spec 38·44) — entity 소유 시각 정의(buildStarBody와 동형 패턴).
// 우주 캔버스(widgets/universe-canvas SelfStar)와 플레이그라운드 미리보기(widgets/cosmos-scene) 둘 다
// 이 한 출처를 쓴다. 색은 uColor 유니폼으로 주입하므로 형태만 바뀌면 재빌드, 색 변경은 유니폼 갱신으로
// 끝난다. 자가발광 emissive(MeshBasicNodeMaterial colorNode) → BloomPass가 글로우로 번지게 한다.
//
// ⚠ 형태는 셰이더만이 아니라 *지오메트리 자체*가 다르다(buildStarBody가 형태별 Icosahedron/Octahedron을
// 쓰는 것과 동형) — "나"가 별처럼 각자 개성 있는 실루엣을 갖도록:
//   • nebula-heart(기본·무료): 노이즈로 표면을 밀어낸 *울퉁불퉁 성운 덩어리* — 정형 구가 아닌 유기적 구름.
//   • core(유료): 또렷한 *발광 구* — 뜨거운 핵 + 숨쉬는 코로나 림(가장 별다운 항성).
//   • well(유료): 진짜 *고리(torus)* — 가운데가 뚫린 링 실루엣 + 고리를 도는 빛 패킷(강착 원반 느낌).
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  float,
  vec3,
  uniform,
  positionLocal,
  normalLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  normalize,
  dot,
  sub,
  max,
  clamp,
  pow,
  sin,
  fract,
  uv,
  mx_noise_float,
} from 'three/tsl'
import type { SelfObject } from '../model/types'

export interface SelfFormBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** 수동 시계 bump(BloomPass 아래에선 내장 time 노드가 멈춰 useFrame에서 직접 갱신). */
  update: (time: number) => void
  /** 몸체 색 갱신(ambient mood 등) — 재빌드 없이 유니폼만 바꾼다. */
  setColor: (color: THREE.Color) => void
}

/** Build the self star's geometry + TSL material for the chosen form. Color rides a uniform
 *  (uColor) so an ambient-mood change updates it without rebuilding the mesh — only the form
 *  selection rebuilds. Each form has its OWN geometry + emissive shader so the silhouettes read
 *  distinct (cloud / orb / ring), not just differently-shaded spheres. */
export function buildSelfForm(form: SelfObject): SelfFormBuild {
  const material = new MeshBasicNodeMaterial()
  const uTime = uniform(0) // manual clock — the built-in `time` node is frozen under BloomPass
  const update = (time: number) => {
    uTime.value = time
  }
  const uColor = uniform(new THREE.Color(0xffffff))
  const setColor = (color: THREE.Color) => {
    uColor.value.copy(color)
  }
  const t = float(uTime as never)
  const base = vec3(uColor as never)

  // View-facing fresnel rim: 0 facing the camera, 1 at the silhouette.
  const viewDir = normalize(sub(cameraPosition, positionWorld))
  const facing = clamp(dot(normalize(normalWorld), viewDir), float(0), float(1))
  const rim = sub(float(1), facing) // 0 centre → 1 rim

  let geometry: THREE.BufferGeometry

  if (form === 'core') {
    // 핵: a bright, near-solid sun — hot centre, brighter rim corona, gentle breathing. A clean
    // radiant ORB (the most "star-like" self).
    geometry = new THREE.IcosahedronGeometry(1, 5)
    const breath = sin(t.mul(0.8)).mul(0.08).add(1)
    material.colorNode = base.mul(float(1.25).add(rim.mul(0.7)).mul(breath))
    material.opacityNode = clamp(facing.mul(0.9).add(0.1), float(0), float(1))
  } else if (form === 'well') {
    // 중력 우물: a true RING (torus) — a hole in the middle, a bright tube rim, and a light packet
    // that orbits the ring (accretion-disk read). Distinct silhouette: a glowing donut, not a sphere.
    geometry = new THREE.TorusGeometry(0.7, 0.26, 24, 72)
    const breath = sin(t.mul(0.7)).mul(0.06).add(1)
    // uv.x runs around the major ring → a bright arc sweeps around it.
    const orbit = fract(uv().x.sub(t.mul(0.12)))
    const packet = pow(orbit, float(2.5)).add(pow(float(1).sub(orbit), float(2.5)))
    const ringGlow = float(0.9).add(rim.mul(0.7)).add(packet.mul(0.6)).mul(breath)
    material.colorNode = base.mul(ringGlow)
    material.opacityNode = clamp(facing.mul(0.5).add(0.5), float(0), float(1))
  } else {
    // 성운 심장(기본): a formless swirl of light — the surface is PUSHED OUT by drifting noise so the
    // silhouette is an irregular, breathing cloud (not a clean sphere). Soft volumetric edge.
    geometry = new THREE.IcosahedronGeometry(1, 4)
    const drift = vec3(t.mul(0.12), t.mul(-0.09), t.mul(0.1))
    const np = positionLocal.mul(1.25).add(drift)
    const lump = float(mx_noise_float(vec3(np as never) as never) as never) // -1..1
    // Push the surface along its normal → lumpy organic blob that slowly morphs.
    material.positionNode = positionLocal.add(normalLocal.mul(lump.mul(0.34)))
    const flow = float(
      mx_noise_float(vec3(np.add(vec3(3.1, 1.7, 5.2)) as never) as never) as never,
    )
      .mul(0.5)
      .add(0.5) // 0..1 drifting
    const glow = float(0.55).add(flow.mul(0.6)).add(rim.mul(0.7))
    material.colorNode = base.mul(glow)
    material.opacityNode = clamp(max(rim.mul(0.6), float(0.32)).mul(flow.mul(0.5).add(0.6)), float(0), float(1))
  }

  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending // emissive glow → bloom
  material.toneMapped = false // keep HDR for bloom
  material.side = THREE.DoubleSide
  return { geometry, material, update, setColor }
}

// 별 뒤에 깔리는 가산 글로우 헤일로 — 별 몸체(star 엔티티)와 분리된, 랜딩 캔버스의 글로우 효과다.
// 우주 캔버스는 이 대신 bloom 후처리를 쓴다. 즉 "별=form(엔티티), 글로우=캔버스가 입히는 효과".
// 밝기는 자체 uniform으로 들고 update로 갱신해 별 몸체와 같은 박자로 맥동한다(호출부는 메서드만 부른다).
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, float, uniform, uv, smoothstep, pow, length } from 'three/tsl'

export interface HaloBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** 매 프레임 밝기 갱신(별 몸체와 동기). */
  update: (bright: number) => void
}

/** mood hex 글로우 평면. 중심이 가장 밝고 가장자리로 투명해진다(가산 합성). */
export function buildHalo(hex: string, brightness: number): HaloBuild {
  const bright = uniform(brightness)
  const update = (b: number) => {
    bright.value = b
  }
  const geometry = new THREE.PlaneGeometry(1, 1)
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.blending = THREE.AdditiveBlending
  const col = vec3(uniform(new THREE.Color(hex)) as never)
  const d = length(uv().sub(0.5)).mul(2.0) // 0(중심)~1.41(모서리)
  const a = smoothstep(float(1.0), float(0.0), d) // 중심 1 → 가장자리 0
  m.colorNode = col
  m.opacityNode = pow(a, float(2.2)).mul(float(bright as never)).mul(0.65)
  return { geometry, material: m, update }
}

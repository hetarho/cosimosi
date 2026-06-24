// 스모크 테스트(plan 50 A7) — 각 기법이 (1) import가 풀리고 (2) 던지지 않고 유효 노드/지오메트리를 만드는지.
// 시각 정확성이 아니라 "그래프가 빌드되는가"만 본다 — 실제 셰이더 컴파일/육안은 소비처(job 30/31)에서.
import { describe, it, expect } from 'vitest'
import { vec2, vec3, float, positionLocal } from 'three/tsl'
import * as THREE from 'three'
import * as art from './index'

const p = vec3(1, 2, 3)

describe('shader-art toolkit — effect family (smoke)', () => {
  it('noise builds nodes', () => {
    expect(art.fbm(p)).toBeTruthy()
    expect(art.fbm01(p, { octaves: 4 })).toBeTruthy()
    expect(art.gnoise(p)).toBeTruthy()
    expect(art.ridged(p)).toBeTruthy()
    const w = art.worley(p)
    expect(w.f1).toBeTruthy()
    expect(w.f2).toBeTruthy()
  })

  it('field transforms build nodes', () => {
    expect(art.domainWarp(p, { amount: 0.8 })).toBeTruthy()
    const s = art.toSpherical(p)
    expect(s.lon).toBeTruthy()
    expect(s.lat).toBeTruthy()
    const pol = art.polar(vec2(1, 2))
    expect(pol.angle).toBeTruthy()
    expect(pol.radius).toBeTruthy()
    expect(art.logSpiral(pol.angle, pol.radius, { arms: 5 })).toBeTruthy()
    expect(art.kaleido(pol.angle, 6)).toBeTruthy()
    expect(art.rotate2(vec2(1, 0), float(0.5))).toBeTruthy()
  })

  it('pattern shapers build nodes', () => {
    const w = art.worley(p)
    expect(art.cellEdge(w.f1, w.f2)).toBeTruthy()
    expect(art.contourSteps(art.fbm01(p))).toBeTruthy()
    expect(art.isoLine(art.fbm01(p))).toBeTruthy()
  })

  it('finish builds nodes', () => {
    expect(art.fresnel(positionLocal, positionLocal)).toBeTruthy()
    expect(art.iridescent(float(1), { baseHue: 0.6 })).toBeTruthy()
  })
})

describe('shader-art toolkit — object family (smoke)', () => {
  it('sdf builds nodes', () => {
    expect(art.sdSphere(p, 1)).toBeTruthy()
    expect(art.sdBox(p, vec3(1))).toBeTruthy()
    expect(art.smin(art.sdSphere(p), art.sdBox(p, vec3(1)), 0.4)).toBeTruthy()
  })

  it('geometry displacement returns a new geometry, same vertex count', () => {
    const base = new THREE.IcosahedronGeometry(1, 2)
    const out = art.displaceGeometry(base, (x) => 0.1 * x)
    expect(out).not.toBe(base)
    expect(out.getAttribute('position').count).toBe(base.getAttribute('position').count)
    base.dispose()
    out.dispose()
  })

  it('polyhedronForStage steps 20→12→8→4 faces as stage rises (change 29)', () => {
    // 단계별 다면체 종류(면 수 감소 = 요지화). three가 삼각분할하므로 정점 수가 아니라 지오메트리 타입으로 본다.
    const types = [0, 1, 2, 3].map((s) => {
      const g = art.polyhedronForStage(s)
      const type = g.type
      g.dispose()
      return type
    })
    expect(types).toEqual([
      'IcosahedronGeometry', // 20면
      'DodecahedronGeometry', // 12면
      'OctahedronGeometry', // 8면
      'TetrahedronGeometry', // 4면
    ])
    // 단계 범위를 넘어도 가장 단순한 형태(4면)로 클램프 — 던지지 않는다.
    const beyond = art.polyhedronForStage(9)
    expect(beyond.type).toBe('TetrahedronGeometry')
    beyond.dispose()
  })

  it('spikyGeometry: small body + tall spikes, outer radius normalized to ~1; spikes=0 is a smooth ball (change 29)', () => {
    const radii = (g: THREE.BufferGeometry) => {
      const pos = g.getAttribute('position')
      const v = new THREE.Vector3()
      let min = Infinity
      let max = 0
      for (let i = 0; i < pos.count; i++) {
        const r = v.fromBufferAttribute(pos, i).length()
        if (r < min) min = r
        if (r > max) max = r
      }
      return { min, max }
    }
    // spikeLen=0.8 → 코어(몸통) 0.2, 가시 끝 1.0. 바깥 반지름은 1로 정규화(별이 안 커진다). sharpness 높게 = 좁은 바늘 → 골이 코어까지 내려간다.
    const spiky = radii(art.spikyGeometry({ spikes: 16, spikeLen: 0.8, sharpness: 24, detail: 3 }))
    expect(spiky.max).toBeLessThanOrEqual(1.001) // 가시 끝 = 1(정규화) — 바깥으로 안 커진다
    expect(spiky.max).toBeGreaterThan(0.9)
    expect(spiky.min).toBeLessThan(0.4) // 몸통은 작다(가시 사이 골)
    const bald = radii(art.spikyGeometry({ spikes: 0, spikeLen: 0.8, detail: 3 }))
    expect(bald.max).toBeLessThan(1.05) // 가시 0 = 매끈한 다각형(요지)
    expect(bald.min).toBeGreaterThan(0.9) // 균일한 구(몸통=가시 구분 없음)
    // 결정론: 같은 입력 = 같은 첫 정점.
    const a = art.spikyGeometry({ spikes: 12, spikeLen: 0.5 })
    const b = art.spikyGeometry({ spikes: 12, spikeLen: 0.5 })
    expect(Array.from(a.getAttribute('position').array.slice(0, 9))).toEqual(
      Array.from(b.getAttribute('position').array.slice(0, 9)),
    )
    a.dispose()
    b.dispose()
  })
})

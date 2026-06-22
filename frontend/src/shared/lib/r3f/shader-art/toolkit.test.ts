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
})

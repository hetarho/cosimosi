// SDF(부호 거리장) 프리미티브 + 부드러운 연산 — 셰이더 기반 유기 형태(메타볼·블롭·자아 오브제)의 재료.
// 순수: 좌표 노드 → 거리 스칼라 노드. (오브젝트 패밀리. 메시 변위는 geometry.ts.)
import { vec3, float, length, max, min, clamp, mix } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

/** 구 SDF — p가 반지름 r 구 표면에서 떨어진 부호 거리(안쪽<0). */
export function sdSphere(p: unknown, r = 1) {
  return length(asVec3Node(p)).sub(r)
}

/** 박스 SDF — b=반쪽 크기 벡터. 모서리 정확. */
export function sdBox(p: unknown, b: unknown) {
  const d = asVec3Node(p).abs().sub(asVec3Node(b))
  return length(max(d, vec3(0))).add(min(max(d.x, max(d.y, d.z)), float(0)))
}

/** 부드러운 union(smin) — 두 거리를 둥글게 합쳐 메타볼처럼 잇는다. k=둥글기(클수록 더 뭉친다). */
export function smin(a: unknown, b: unknown, k = 0.5) {
  const an = asFloatNode(a)
  const bn = asFloatNode(b)
  const kn = float(k)
  const h = clamp(float(0.5).add(bn.sub(an).mul(0.5).div(kn)), float(0), float(1))
  return mix(bn, an, h).sub(kn.mul(h).mul(float(1).sub(h)))
}

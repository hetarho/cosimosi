// 공간 변환 — 같은 노이즈도 좌표를 바꾸면 전혀 다른 무늬가 된다. 나선·소용돌이·대칭·와류의 베이스.
// 전부 순수: 좌표 노드를 받아 변환된 좌표/스칼라 노드를 돌려준다(plan 50 A2).
import { vec2, vec3, float, atan, asin, cos, sin, mod, log, length, clamp, abs, max } from 'three/tsl'
import { asFloatNode, asVec2Node, asVec3Node } from '../tsl'
import { fbm } from './noise'

export interface DomainWarpOptions {
  /** 좌표를 휘게 하는 세기 — 클수록 무늬가 휘몰아친다(작으면 잔잔·고른 결). */
  amount?: number
  /** 워프 노이즈 옥타브. */
  octaves?: number
}

/** 도메인워프 — fbm으로 좌표 자체를 휘게 한다. 대리석·유체·연기 와류. */
export function domainWarp(p: unknown, { amount = 0.6, octaves = 3 }: DomainWarpOptions = {}) {
  const pv = asVec3Node(p)
  // 서로 다른 오프셋의 fbm 3개를 좌표에 더해 grid를 비튼다(오프셋은 결이 겹치지 않게 하는 임의 상수).
  const wx = fbm(pv, { octaves })
  const wy = fbm(pv.add(vec3(5.2, 1.3, 2.7)), { octaves })
  const wz = fbm(pv.add(vec3(1.7, 9.2, 3.1)), { octaves })
  return pv.add(vec3(wx, wy, wz).mul(amount))
}

/** 단위 방향 벡터 → 구면 좌표. lon=경도(-π..π), lat=위도(-π/2..π/2). 방사/대칭 무늬의 베이스. */
export function toSpherical(dir: unknown) {
  const d = asVec3Node(dir)
  return { lon: asFloatNode(atan(d.z, d.x)), lat: asFloatNode(asin(clamp(d.y, float(-1), float(1)))) }
}

/** 2D 벡터 → 극좌표. angle=각(-π..π), radius=원점까지 거리. */
export function polar(v: unknown) {
  const p = asVec2Node(v)
  return { angle: asFloatNode(atan(p.y, p.x)), radius: asFloatNode(length(p)) }
}

export interface LogSpiralOptions {
  /** 나선팔 개수 — angle에 곱해지는 정수. */
  arms?: number
  /** 팔이 감기는 정도 — log(radius) 계수. 클수록 촘촘히 감긴다. */
  twist?: number
}

/** 로그-스파이럴 위상 — angle·arms + log(radius)·twist. sin을 씌우면 나선팔이 된다. 나선은하·소용돌이.
 *  radius=0(중심)에서 log 발산을 막으려 하한을 둔다. */
export function logSpiral(angle: unknown, radius: unknown, { arms = 5, twist = 1 }: LogSpiralOptions = {}) {
  return asFloatNode(angle).mul(arms).add(log(max(asFloatNode(radius), float(1e-3))).mul(twist))
}

/** 만화경 접기 — 각을 segments등분해 거울 대칭으로 접는다. 만다라·신성기하. 반환=접힌 각(0..π/segments). */
export function kaleido(angle: unknown, segments = 6) {
  const seg = float((Math.PI * 2) / segments)
  return abs(mod(asFloatNode(angle), seg).sub(seg.mul(0.5)))
}

/** 2D 회전 — 시간 등으로 무늬를 돌린다. */
export function rotate2(v: unknown, angle: unknown) {
  const p = asVec2Node(v)
  const a = asFloatNode(angle)
  const c = cos(a)
  const s = sin(a)
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)))
}

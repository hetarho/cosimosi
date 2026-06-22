// 색·마감 — 구조 위에 빛/색감을 입히는 마지막 단계. 순수 노드 in/out.
import { vec3, float, pow, clamp, dot, abs, sin, mx_hsvtorgb } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

/** Fresnel — 시선과 법선이 스칠수록(가장자리) 1에 가까워진다. 대기 림·코어 글로우. power↑일수록 얇은 테두리만. */
export function fresnel(viewDir: unknown, normal: unknown, power = 3) {
  const f = float(1).sub(abs(dot(asVec3Node(viewDir), asVec3Node(normal))))
  return pow(clamp(f, float(0), float(1)), float(power))
}

export interface IridescentOptions {
  /** 중심 색상(0..1 HSV hue) — mood 색과 조율할 기준 hue. */
  baseHue?: number
  /** 색상이 미끄러지는 폭 — 클수록 무지개가 넓게 돈다. */
  range?: number
  /** 채도. */
  sat?: number
  /** 명도. */
  val?: number
}

/** 박막 간섭(기름막) 색조 — 위상(시선각·시간 등)에 따라 색상이 미끄러진다. baseHue 주위로 진동하는 진주광. */
export function iridescent(phase: unknown, { baseHue = 0.6, range = 0.25, sat = 0.6, val = 1 }: IridescentOptions = {}) {
  const hue = float(baseHue).add(sin(asFloatNode(phase)).mul(range))
  return asVec3Node(mx_hsvtorgb(vec3(hue, float(sat), float(val))))
}

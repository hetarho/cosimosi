// 배경 스킨 검증(plan 51) — registry 총괄성(A2/A3)·values↔카탈로그 정합(A7/A8)·조립 스모크.
// 시각 정확성이 아니라 "구조가 정합하고 노드가 빌드되는가"만 본다(육안은 사용자 튜닝).
import { describe, it, expect } from 'vitest'
import { vec3, float } from 'three/tsl'
import { BACKGROUND_FORMS, type BackgroundFieldContext } from './background-form'
import { BACKGROUNDS } from '../model/backgrounds'
import { isFree, priceOf } from '@/shared/config'

describe('background skins (plan 51)', () => {
  it('모든 카탈로그 effect에 registry 조립 함수가 있다(총괄성)', () => {
    for (const bg of BACKGROUNDS) {
      expect(typeof BACKGROUND_FORMS[bg.effect]).toBe('function')
    }
  })

  it('registry에 카탈로그에 없는 고아 effect가 없다', () => {
    const effects = new Set<string>(BACKGROUNDS.map((b) => b.effect))
    for (const key of Object.keys(BACKGROUND_FORMS)) {
      expect(effects.has(key)).toBe(true)
    }
  })

  it('모든 배경 id는 무료이거나 가격이 있다(values↔카탈로그 정합) · 무료는 galaxy 단 하나', () => {
    for (const bg of BACKGROUNDS) {
      const id = `background:${bg.id}`
      expect(isFree(id) || typeof priceOf(id) === 'number').toBe(true)
    }
    expect(isFree('background:galaxy')).toBe(true)
    const freeCount = BACKGROUNDS.filter((b) => isFree(`background:${b.id}`)).length
    expect(freeCount).toBe(1)
  })

  it('각 조립 함수가 던지지 않고 색 노드를 만든다(스모크)', () => {
    const v = vec3(0.3, 0.5, 0.7)
    const f = float(0.5)
    // 셸이 넘기는 컨텍스트의 최소 형태(노드 타입은 테스트용으로 느슨하게 캐스팅).
    const ctx = {
      dir: v, deep: v, flow: v, speed: f, presence: f, e0: v, e1: v, e2: v, t: f,
      oct: 3, warp: 0.6, freq: 1, detail: 0.5, params: {},
    } as unknown as BackgroundFieldContext
    for (const bg of BACKGROUNDS) {
      expect(BACKGROUND_FORMS[bg.effect](ctx)).toBeTruthy()
    }
  })
})

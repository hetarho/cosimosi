// 별 형태×표면 디컴포지션·합성 인코딩 단위 테스트(spec 52). 순수 model — three/DOM 미의존.
import { describe, expect, it } from 'vitest'
import { VALUES } from '@/shared/config'
import {
  STAR_FORMS,
  STAR_SURFACES,
  STAR_PRESETS,
  DEFAULT_STAR_FORM,
  DEFAULT_STAR_SURFACE,
  DEFAULT_STAR_SELECTION,
  encodeStarSelection,
  decodeStarSelection,
  normalizeStarSelection,
} from './forms'

describe('star forms — 디컴포지션·합성 인코딩', () => {
  it('encode/decode 라운드트립 — 모든 form×surface 조합', () => {
    for (const f of STAR_FORMS) {
      for (const s of STAR_SURFACES) {
        const wire = encodeStarSelection(f.id, s.id)
        expect(wire).toBe(`${f.id}+${s.id}`)
        expect(decodeStarSelection(wire)).toEqual({ form: f.id, surface: s.id })
      }
    }
  })

  it('레거시 단일 id는 프리셋으로 디컴포지션(crystal·liquid·ember 시각 보존)', () => {
    expect(decodeStarSelection('deepfield')).toEqual({ form: 'lowpoly', surface: 'facet' })
    expect(decodeStarSelection('liquid')).toEqual({ form: 'liquid', surface: 'glossy' })
    expect(decodeStarSelection('ember')).toEqual({ form: 'octa', surface: 'lava' })
    expect(decodeStarSelection('aurora')).toEqual({ form: 'cloudy', surface: 'cloud' })
    expect(decodeStarSelection('pulsar')).toEqual({ form: 'smooth', surface: 'pulse' })
  })

  it('미지/빈 값·반쪽 미지 sub-id는 축 기본으로 폴백(A9, 크래시 없음)', () => {
    expect(decodeStarSelection('nope')).toEqual(STAR_PRESETS.deepfield)
    expect(decodeStarSelection(undefined)).toEqual(STAR_PRESETS.deepfield)
    expect(decodeStarSelection('')).toEqual(STAR_PRESETS.deepfield)
    expect(decodeStarSelection('octa+bogus')).toEqual({ form: 'octa', surface: DEFAULT_STAR_SURFACE })
    expect(decodeStarSelection('bogus+lava')).toEqual({ form: DEFAULT_STAR_FORM, surface: 'lava' })
  })

  it('normalize는 항상 유효 합성을 돌려준다', () => {
    expect(normalizeStarSelection('pulsar')).toBe('smooth+pulse')
    expect(normalizeStarSelection('garbage')).toBe(DEFAULT_STAR_SELECTION)
    expect(DEFAULT_STAR_SELECTION).toBe('lowpoly+facet')
  })

  it('values 정합 — 무료 슬롯 기본이 카탈로그 기본과 같다', () => {
    const free = VALUES.customization.free as Record<string, string>
    expect(free['star:form']).toBe(DEFAULT_STAR_FORM)
    expect(free['star:surface']).toBe(DEFAULT_STAR_SURFACE)
  })

  it('values 정합 — 모든 유료 star sub-item 가격 키가 실제 카탈로그 id를 가리킨다', () => {
    const price = VALUES.customization.price as Record<string, number>
    const formIds = new Set<string>(STAR_FORMS.map((f) => f.id))
    const surfaceIds = new Set<string>(STAR_SURFACES.map((s) => s.id))
    for (const key of Object.keys(price)) {
      if (key.startsWith('star:form:')) expect(formIds.has(key.slice('star:form:'.length))).toBe(true)
      if (key.startsWith('star:surface:'))
        expect(surfaceIds.has(key.slice('star:surface:'.length))).toBe(true)
    }
  })
})

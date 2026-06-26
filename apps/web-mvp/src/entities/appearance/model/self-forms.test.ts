// 자아 형태×표면 디컴포지션·합성 인코딩 단위 테스트(spec 52). 순수 model.
import { describe, expect, it } from 'vitest'
import { VALUES } from '@/shared/config'
import {
  SELF_FORMS,
  SELF_SURFACES,
  SELF_PRESETS,
  DEFAULT_SELF_FORM,
  DEFAULT_SELF_SURFACE,
  DEFAULT_SELF_SELECTION,
  encodeSelfSelection,
  decodeSelfSelection,
  normalizeSelfSelection,
} from './self-forms'

describe('self forms — 디컴포지션·합성 인코딩', () => {
  it('encode/decode 라운드트립', () => {
    for (const f of SELF_FORMS)
      for (const s of SELF_SURFACES)
        expect(decodeSelfSelection(encodeSelfSelection(f.id, s.id))).toEqual({ form: f.id, surface: s.id })
  })

  it('레거시 단일 id 프리셋 디컴포지션(시각 보존)', () => {
    expect(decodeSelfSelection('mirrorball')).toEqual({ form: 'orb', surface: 'mirror' })
    expect(decodeSelfSelection('prism-cube')).toEqual({ form: 'cube', surface: 'prism' })
    expect(decodeSelfSelection('neuron-bloom')).toEqual({ form: 'bloom', surface: 'neuron' })
  })

  it('미지/반쪽 미지 → 축 기본 폴백(A9)', () => {
    expect(decodeSelfSelection('nope')).toEqual(SELF_PRESETS.mirrorball)
    expect(decodeSelfSelection('cube+bogus')).toEqual({ form: 'cube', surface: DEFAULT_SELF_SURFACE })
    expect(decodeSelfSelection('bogus+prism')).toEqual({ form: DEFAULT_SELF_FORM, surface: 'prism' })
  })

  it('normalize·기본 합성', () => {
    expect(DEFAULT_SELF_SELECTION).toBe('orb+mirror')
    expect(normalizeSelfSelection('prism-cube')).toBe('cube+prism')
    expect(normalizeSelfSelection('garbage')).toBe(DEFAULT_SELF_SELECTION)
  })

  it('values 정합 — 무료 슬롯·가격 키', () => {
    const free = VALUES.customization.free as Record<string, string>
    expect(free['self:form']).toBe(DEFAULT_SELF_FORM)
    expect(free['self:surface']).toBe(DEFAULT_SELF_SURFACE)
    const price = VALUES.customization.price as Record<string, number>
    const formIds = new Set<string>(SELF_FORMS.map((f) => f.id))
    const surfaceIds = new Set<string>(SELF_SURFACES.map((s) => s.id))
    for (const key of Object.keys(price)) {
      if (key.startsWith('self:form:')) expect(formIds.has(key.slice('self:form:'.length))).toBe(true)
      if (key.startsWith('self:surface:'))
        expect(surfaceIds.has(key.slice('self:surface:'.length))).toBe(true)
    }
  })
})

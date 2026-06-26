// 시냅스 형태×표면 디컴포지션·합성 인코딩 단위 테스트(spec 52). 순수 model.
import { describe, expect, it } from 'vitest'
import { VALUES } from '@/shared/config'
import {
  SYNAPSE_FORMS,
  SYNAPSE_SURFACES,
  SYNAPSE_PRESETS,
  DEFAULT_SYNAPSE_FORM,
  DEFAULT_SYNAPSE_SURFACE,
  DEFAULT_SYNAPSE_SELECTION,
  encodeSynapseSelection,
  decodeSynapseSelection,
  normalizeSynapseSelection,
} from './forms'

describe('synapse forms — 디컴포지션·합성 인코딩', () => {
  it('encode/decode 라운드트립', () => {
    for (const f of SYNAPSE_FORMS)
      for (const s of SYNAPSE_SURFACES)
        expect(decodeSynapseSelection(encodeSynapseSelection(f.id, s.id))).toEqual({
          form: f.id,
          surface: s.id,
        })
  })

  it('레거시 단일 id 프리셋 디컴포지션(filament 보존)', () => {
    expect(decodeSynapseSelection('filament')).toEqual({ form: 'strands', surface: 'flow' })
    expect(decodeSynapseSelection('particle')).toEqual({ form: 'dotted', surface: 'beads' })
    expect(decodeSynapseSelection('dendrite')).toEqual({ form: 'branched', surface: 'flow' })
  })

  it('미지/반쪽 미지 → 축 기본 폴백(A9)', () => {
    expect(decodeSynapseSelection('nope')).toEqual(SYNAPSE_PRESETS.filament)
    expect(decodeSynapseSelection('dotted+bogus')).toEqual({
      form: 'dotted',
      surface: DEFAULT_SYNAPSE_SURFACE,
    })
    expect(decodeSynapseSelection('bogus+beads')).toEqual({
      form: DEFAULT_SYNAPSE_FORM,
      surface: 'beads',
    })
  })

  it('normalize·기본 합성', () => {
    expect(DEFAULT_SYNAPSE_SELECTION).toBe('strands+flow')
    expect(normalizeSynapseSelection('particle')).toBe('dotted+beads')
    expect(normalizeSynapseSelection('garbage')).toBe(DEFAULT_SYNAPSE_SELECTION)
  })

  it('values 정합 — 무료 슬롯·가격 키', () => {
    const free = VALUES.customization.free as Record<string, string>
    expect(free['synapse:form']).toBe(DEFAULT_SYNAPSE_FORM)
    expect(free['synapse:surface']).toBe(DEFAULT_SYNAPSE_SURFACE)
    const price = VALUES.customization.price as Record<string, number>
    const formIds = new Set<string>(SYNAPSE_FORMS.map((f) => f.id))
    const surfaceIds = new Set<string>(SYNAPSE_SURFACES.map((s) => s.id))
    for (const key of Object.keys(price)) {
      if (key.startsWith('synapse:form:'))
        expect(formIds.has(key.slice('synapse:form:'.length))).toBe(true)
      if (key.startsWith('synapse:surface:'))
        expect(surfaceIds.has(key.slice('synapse:surface:'.length))).toBe(true)
    }
  })
})

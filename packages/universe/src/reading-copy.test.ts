import { describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { forgettingStageLabel, neuronTypeLabel, readingPercent } from './reading-copy.ts'

describe('reading copy', () => {
  setActiveLocale(defaultLocale)

  it('clamps a stage past either end of the labels to the nearest one', () => {
    expect(forgettingStageLabel(-1)).toBe(m.star_meta_forgetting_vivid())
    expect(forgettingStageLabel(2)).toBe(m.star_meta_forgetting_blurring())
    expect(forgettingStageLabel(99)).toBe(m.star_meta_forgetting_distant())
  })

  it('names each neuron kind and reads a fraction as a whole percentage', () => {
    expect(neuronTypeLabel('semantic')).toBe(m.star_meta_neuron_type_semantic())
    expect(neuronTypeLabel('entity')).toBe(m.star_meta_neuron_type_entity())
    expect(readingPercent(0.874)).toBe('87%')
  })
})

import { m } from '@cosimosi/i18n'

import type { Neuron } from '@cosimosi/memory'

// The star panel's reading labels, beside the types they name, so both platforms' readings speak one
// projection and cannot drift into two spellings of the same reading.

// The forgetting-degree label for a decay stage (0 = vivid). Stages deepen the fade word; the stage
// count is [F9]-tunable, so a stage past the last known label reads as the last one.
export function forgettingStageLabel(stage: number): string {
  const labels = [
    m.star_meta_forgetting_vivid(),
    m.star_meta_forgetting_softening(),
    m.star_meta_forgetting_blurring(),
    m.star_meta_forgetting_faint(),
    m.star_meta_forgetting_distant(),
  ]
  return labels[Math.min(Math.max(stage, 0), labels.length - 1)]
}

export function neuronTypeLabel(type: Neuron['neuronType']): string {
  if (type === 'semantic') return m.star_meta_neuron_type_semantic()
  if (type === 'spatial') return m.star_meta_neuron_type_spatial()
  return m.star_meta_neuron_type_entity()
}

// A 0..1 reading as a whole percentage.
export function readingPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

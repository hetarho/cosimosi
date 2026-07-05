export const NEURON_TYPES = ['semantic', 'spatial', 'entity'] as const

export type NeuronType = (typeof NEURON_TYPES)[number]

export function isNeuronType(value: string): value is NeuronType {
  return (NEURON_TYPES as readonly string[]).includes(value)
}

// FE domain mirror of the stored neuron facts (GetUniverse contract).
export interface Neuron {
  readonly id: string
  readonly name: string | null
  readonly neuronType: NeuronType
  /** Degree over visible memories — the layout radius input [V1], never emotion [I3]. */
  readonly connectivity: number
}

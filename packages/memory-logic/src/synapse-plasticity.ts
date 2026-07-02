import { VALUES } from '@cosimosi/config'

export const SIGNAL_KINDS = ['same_memory', 'shared_neuron', 'temporal'] as const

export type SignalKind = (typeof SIGNAL_KINDS)[number]

const initialStrengthByKind = {
  same_memory: VALUES.synapse.initialSameMemory,
  shared_neuron: VALUES.synapse.initialSharedNeuron,
  temporal: VALUES.synapse.initialTemporal,
} as const satisfies Record<SignalKind, number>

export function potentiate(strength: number, rate: number): number {
  const boundedStrength = clamp(strength, 0, VALUES.synapse.strengthCap)
  const boundedRate = clamp(rate, 0, 1)
  return clamp(
    boundedStrength + boundedRate * (VALUES.synapse.strengthCap - boundedStrength),
    0,
    VALUES.synapse.strengthCap,
  )
}

export function depress(strength: number, amount: number): number {
  const boundedStrength = clamp(strength, 0, VALUES.synapse.strengthCap)
  const boundedAmount = Math.max(0, amount)
  return clamp(boundedStrength - boundedAmount, 0, VALUES.synapse.strengthCap)
}

export function initialStrength(signalKind: string): number {
  if (!isSignalKind(signalKind)) {
    throw new RangeError(`unknown SignalKind: ${signalKind}`)
  }
  return initialStrengthByKind[signalKind]
}

export function isSignalKind(value: string): value is SignalKind {
  return (SIGNAL_KINDS as readonly string[]).includes(value)
}

export function effectiveSynapseStrength(base: number, elapsedUniverseDays: number): number {
  const boundedBase = clamp(base, 0, VALUES.synapse.strengthCap)
  const boundedElapsed = Math.max(0, elapsedUniverseDays)
  const decayPerDay = clamp(VALUES.synapse.strengthDecayPerDay, 0, 1)
  return clamp(boundedBase * Math.pow(1 - decayPerDay, boundedElapsed), 0, boundedBase)
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}

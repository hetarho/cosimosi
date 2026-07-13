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

// Homeostatic sleep downscaling (SHY, [C4]) — the global per-sleep renormalization, a distinct
// mechanism from depress/LTD ([I9]): weak edges lose proportionally more headroom, strong edges
// are spared by the weak-bias exponent, and the positive residual floor means an edge dims toward
// silence but is never removed (an edge already at/below the floor is left as-is) ([I1]).
// Golden-parity with the Go internal/memory implementation.
export function downscale(strength: number, factor: number): number {
  const boundedStrength = clamp(strength, 0, VALUES.synapse.strengthCap)
  const boundedFactor = clamp(factor, 0, 1)
  const loss =
    boundedFactor *
    (1 -
      Math.pow(
        boundedStrength / VALUES.synapse.strengthCap,
        VALUES.consolidation.downscaleWeakBias,
      ))
  const next = boundedStrength * (1 - loss)
  const residualFloor = Math.min(boundedStrength, VALUES.consolidation.downscaleFloor)
  return clamp(next, residualFloor, boundedStrength)
}

export function applyTemporalBonus(strength: number): number {
  return clamp(strength + VALUES.synapse.temporalBonus, 0, VALUES.synapse.strengthCap)
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

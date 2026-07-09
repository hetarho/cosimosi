import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import {
  applyTemporalBonus,
  depress,
  effectiveSynapseStrength,
  initialStrength,
  isSignalKind,
  potentiate,
  type SignalKind,
} from './synapse-plasticity.ts'

interface SynapseFixture {
  readonly tolerance: number
  readonly values: {
    readonly potentiation_rate: number
    readonly strength_cap: number
    readonly initial_same_memory: number
    readonly initial_shared_neuron: number
    readonly initial_temporal: number
    readonly strength_decay_per_day: number
  }
  readonly cases: readonly SynapseFixtureCase[]
}

interface SynapseFixtureCase {
  readonly function: string
  readonly inputs: {
    readonly strength?: number
    readonly rate?: number
    readonly iterations?: number
    readonly amount?: number
    readonly signal_kind?: SignalKind
    readonly base?: number
    readonly elapsed_universe_days?: number
  }
  readonly expected: number
}

const fixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/synapse-plasticity-golden.json',
  import.meta.url,
)

describe('synapse plasticity', () => {
  it('keeps generated synapse constants aligned with the golden fixture', () => {
    const fixture = readFixture()

    expect(fixture.values).toEqual({
      potentiation_rate: VALUES.synapse.potentiationRate,
      strength_cap: VALUES.synapse.strengthCap,
      initial_same_memory: VALUES.synapse.initialSameMemory,
      initial_shared_neuron: VALUES.synapse.initialSharedNeuron,
      initial_temporal: VALUES.synapse.initialTemporal,
      strength_decay_per_day: VALUES.synapse.strengthDecayPerDay,
    })
  })

  it('keeps Potentiate monotone, diminishing, and capped', () => {
    for (const rate of [0, VALUES.synapse.potentiationRate, 1]) {
      let previousIncrement = Number.POSITIVE_INFINITY
      for (const strength of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        const next = potentiate(strength, rate)
        expect(next).toBeGreaterThanOrEqual(strength)
        expect(next).toBeLessThanOrEqual(VALUES.synapse.strengthCap)
        const increment = next - strength
        expect(increment).toBeLessThanOrEqual(previousIncrement + 1e-12)
        previousIncrement = increment
      }
    }

    expect(potentiate(VALUES.synapse.strengthCap, VALUES.synapse.potentiationRate)).toBe(
      VALUES.synapse.strengthCap,
    )

    let strength = 0.2
    for (let index = 0; index < 200; index += 1) {
      const next = potentiate(strength, VALUES.synapse.potentiationRate)
      expect(next).toBeGreaterThanOrEqual(strength)
      expect(next).toBeLessThanOrEqual(VALUES.synapse.strengthCap)
      strength = next
    }
    expect(strength).toBeGreaterThanOrEqual(VALUES.synapse.strengthCap - 1e-9)
  })

  it('keeps InitialStrength low and signal-tiered under one cap', () => {
    expect(VALUES.synapse.strengthCap).toBe(1)

    const sameMemory = initialStrength('same_memory')
    const sharedNeuron = initialStrength('shared_neuron')
    const temporal = initialStrength('temporal')

    expect(sameMemory).toBeGreaterThan(sharedNeuron)
    expect(sharedNeuron).toBeGreaterThan(temporal)
    for (const strength of [sameMemory, sharedNeuron, temporal]) {
      expect(strength).toBeGreaterThan(0)
      expect(strength).toBeLessThan(VALUES.synapse.strengthCap)
    }
  })

  it('rejects unknown signal kinds at runtime', () => {
    expect(isSignalKind('same_memory')).toBe(true)
    expect(isSignalKind('unknown')).toBe(false)
    expect(() => initialStrength('unknown')).toThrow(RangeError)
  })

  it('keeps Depress local and floor-clamped', () => {
    for (const testCase of [
      { strength: 0.8, amount: 0.2 },
      { strength: 0.08, amount: 0.2 },
      { strength: 0, amount: 0.1 },
    ]) {
      const next = depress(testCase.strength, testCase.amount)
      expect(next).toBeLessThanOrEqual(testCase.strength)
      expect(next).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps EffectiveSynapseStrength read-time, monotone, and non-mutating', () => {
    const base = 0.72
    expect(effectiveSynapseStrength(base, 0)).toBeCloseTo(base, 12)

    let previous = base
    for (const elapsed of [1, 3, 10, 30, 365]) {
      const next = effectiveSynapseStrength(base, elapsed)
      expect(next).toBeLessThanOrEqual(previous + 1e-12)
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThanOrEqual(base)
      previous = next
    }
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()

    for (const testCase of fixture.cases) {
      if (!isSynapseFixtureCase(testCase.function)) continue
      let got: number
      switch (testCase.function) {
        case 'potentiate':
          got = potentiate(required(testCase.inputs.strength), required(testCase.inputs.rate))
          break
        case 'potentiate_repeated':
          got = required(testCase.inputs.strength)
          for (let index = 0; index < required(testCase.inputs.iterations); index += 1) {
            got = potentiate(got, required(testCase.inputs.rate))
          }
          break
        case 'depress':
          got = depress(required(testCase.inputs.strength), required(testCase.inputs.amount))
          break
        case 'initial_strength':
          got = initialStrength(required(testCase.inputs.signal_kind))
          break
        case 'apply_temporal_bonus':
          got = applyTemporalBonus(required(testCase.inputs.strength))
          break
        case 'effective_synapse_strength':
          got = effectiveSynapseStrength(
            required(testCase.inputs.base),
            required(testCase.inputs.elapsed_universe_days),
          )
          break
      }
      expectClose(got, testCase.expected, fixture.tolerance)
    }
  })
})

function readFixture(): SynapseFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as SynapseFixture
}

function isSynapseFixtureCase(functionName: string): functionName is SynapseFunctionName {
  return (
    functionName === 'potentiate' ||
    functionName === 'potentiate_repeated' ||
    functionName === 'depress' ||
    functionName === 'initial_strength' ||
    functionName === 'apply_temporal_bonus' ||
    functionName === 'effective_synapse_strength'
  )
}

type SynapseFunctionName =
  | 'potentiate'
  | 'potentiate_repeated'
  | 'depress'
  | 'initial_strength'
  | 'apply_temporal_bonus'
  | 'effective_synapse_strength'

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}

function expectClose(got: number, want: number, tolerance: number): void {
  expect(Math.abs(got - want)).toBeLessThanOrEqual(tolerance)
}

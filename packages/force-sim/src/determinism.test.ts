import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DEFAULT_FORCE_SIM_VALUES, createForceSimulation, type ForceSimGraph } from './index.ts'

interface GoldenFixture {
  readonly graph: ForceSimGraph
  readonly seed: number
  readonly ticks: number
  readonly dt: number
  readonly coordinates: readonly number[]
}

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/canonical.json', import.meta.url)), 'utf8'),
) as GoldenFixture

describe('force-sim determinism', () => {
  it('matches the canonical coordinate-buffer fixture byte-for-byte', () => {
    expect(runFixture(fixture.seed)).toEqual(fixture.coordinates)
  })

  it('repeats the same graph, seed, and tick sequence exactly', () => {
    expect(runFixture(fixture.seed)).toEqual(runFixture(fixture.seed))
  })

  it('diverges when the deterministic seed changes', () => {
    expect(runFixture(fixture.seed + 1)).not.toEqual(fixture.coordinates)
  })
})

function runFixture(seed: number): number[] {
  const simulation = createForceSimulation(fixture.graph, {
    values: {
      ...DEFAULT_FORCE_SIM_VALUES,
      seed,
    },
  })
  for (let tick = 0; tick < fixture.ticks; tick += 1) simulation.tick(fixture.dt)
  return Array.from(simulation.coordinates)
}

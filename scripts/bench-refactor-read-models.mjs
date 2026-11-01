// Run with Node's TypeScript support: node --expose-gc scripts/bench-refactor-read-models.mjs.
// Optional baseline simulation module: COSIMOSI_BASELINE_SIM=/absolute/path/simulation.ts.
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

import { createUniverseMapper, universeFromResponse } from '../packages/memory/src/mappers.ts'
import { createForceSimulation } from '../packages/force-sim/src/simulation.ts'

const baseline = process.env.COSIMOSI_BASELINE_SIM
  ? (await import(pathToFileURL(process.env.COSIMOSI_BASELINE_SIM).href)).createForceSimulation
  : null

function responseFixture(count) {
  const neuronCount = Math.max(2, Math.ceil(count / 3))
  return {
    universeTime: '2026-11-02',
    memories: Array.from({ length: count }, (_, i) => ({
      id: `m-${i}`,
      diaryId: `d-${i}`,
      name: `Memory ${i}`,
      emotion: { mood: 'JOY', valence: 0.5, arousal: 0.5, intensity: 0.5 },
      baseStrength: 0.5,
      recallCount: 0,
      createdUniverseTime: '2026-01-01',
      lastRecalledUniverseTime: undefined,
      seed: 42n,
      activations: [{ neuronId: `n-${i % neuronCount}`, weight: 1 }],
      currentText: `Memory ${i}: ` + 'A retained account of the day. '.repeat(40),
      decayStages: Array.from(
        { length: 4 },
        (_, stage) => `Stage ${stage}: ` + 'A retained fragment. '.repeat(20),
      ),
      forgettingOffsetDays: 0,
      semanticStage: 0,
    })),
    neurons: Array.from({ length: neuronCount }, (_, i) => ({
      id: `n-${i}`,
      neuronType: 'semantic',
      name: `Concept ${i}`,
      connectivity: 3,
    })),
    synapses: Array.from({ length: neuronCount - 1 }, (_, i) => {
      const [a, b] = [`n-${i}`, `n-${i + 1}`].sort()
      return {
        id: `s-${i}`,
        neuronAId: a,
        neuronBId: b,
        strength: 0.5,
        coActivationCount: 1,
        lastActivatedUniverseTime: '2026-01-01',
      }
    }),
  }
}

function time(fn, runs) {
  const start = performance.now()
  for (let i = 0; i < runs; i++) fn()
  return +(performance.now() - start).toFixed(3) / runs
}

function simulationCost(create, graph) {
  const sim = create(graph)
  sim.tick(1 / 60)
  return time(() => sim.tick(1 / 60), 120)
}

const rows = []
for (const count of [100, 1000, 10000]) {
  const response = responseFixture(count)
  const cached = createUniverseMapper()
  cached(response)
  const freshProjectionMs = time(() => universeFromResponse(response), 30)
  const reusedProjectionMs = time(() => cached(response), 30)
  const graph = {
    neurons: response.neurons.map(({ id, connectivity }) => ({ id, connectivity })),
    episodicMemories: response.memories.map(({ id }) => ({ id })),
    activations: response.memories.map((m) => ({ episodicMemoryId: m.id, ...m.activations[0] })),
    synapses: response.synapses.map((s) => ({
      sourceNeuronId: s.neuronAId,
      targetNeuronId: s.neuronBId,
      strength: s.strength,
    })),
  }
  rows.push({
    count,
    jsonBytes: Buffer.byteLength(
      JSON.stringify(response, (_, value) => (typeof value === 'bigint' ? String(value) : value)),
    ),
    freshProjectionMs,
    reusedProjectionMs,
    tickMs: simulationCost(createForceSimulation, graph),
    baselineTickMs: baseline ? simulationCost(baseline, graph) : null,
  })
}
process.stdout.write(
  JSON.stringify(
    { node: process.version, platform: process.platform, arch: process.arch, rows },
    null,
    2,
  ) + '\n',
)

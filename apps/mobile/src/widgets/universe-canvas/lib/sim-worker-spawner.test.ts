import { createSimWorkerSpawner } from './sim-worker-spawner.ts'

// The native half of the sim-spawner fork (§3.5: a fork owns its own test). React Native ships no
// standard Worker primitive, so this must decline and let the shared bridge run the sim inline on the
// JS thread. The assertion looks trivial and is the point: the day an RN worker primitive lands, this
// is the seam that changes, and the mirror test on web pins the other side of it.
describe('native sim worker spawner', () => {
  it('declines, so the bridge runs the sim inline on the JS thread', () => {
    expect(createSimWorkerSpawner()).toBeNull()
  })

  it('does not reach for a Worker global even when one exists', () => {
    // A polyfill or a test shim defining `Worker` must not flip native onto a path its bridge cannot
    // drive — the decision is the platform's, not the environment's.
    const globals = globalThis as { Worker?: unknown }
    const original = globals.Worker
    globals.Worker = function FakeWorker() {}
    try {
      expect(createSimWorkerSpawner()).toBeNull()
    } finally {
      if (original === undefined) delete globals.Worker
      else globals.Worker = original
    }
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSimWorkerSpawner } from './sim-worker-spawner.ts'

// One of the two forks of the sim-spawner seam (§3.5: a fork owns its own test). Web spawns a real
// module Worker so the sim runs off the render thread; the native sibling returns null and the same
// bridge runs the sim inline. What can silently break here is the fallback: without a Worker
// primitive the spawner must decline rather than throw at bridge construction.
describe('web sim worker spawner', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('declines in an environment without Worker instead of throwing later', () => {
    vi.stubGlobal('Worker', undefined)
    expect(createSimWorkerSpawner()).toBeNull()
  })

  it('spawns a module worker pointed at the universe sim', () => {
    const constructed: Array<{ url: string; options: unknown }> = []
    class FakeWorker {
      constructor(url: URL | string, options: unknown) {
        constructed.push({ url: String(url), options })
      }
    }
    vi.stubGlobal('Worker', FakeWorker)

    const spawn = createSimWorkerSpawner()
    expect(spawn).not.toBeNull()
    spawn?.()

    expect(constructed).toHaveLength(1)
    expect(constructed[0]?.url).toContain('universe-sim.worker')
    // A classic worker cannot import the ESM sim module, so the type is load-bearing.
    expect(constructed[0]?.options).toEqual({ type: 'module' })
  })
})

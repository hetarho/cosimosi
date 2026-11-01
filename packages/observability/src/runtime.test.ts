import { describe, expect, it, vi } from 'vitest'

import { createInMemoryTelemetryAdapter } from './memory-adapter.ts'
import { createObservabilityRuntime, createTelemetryBindingManager } from './runtime.ts'

describe('runtime ownership', () => {
  it('retains no event history by default and bounds explicitly enabled history', () => {
    const runtime = createObservabilityRuntime()
    const history = createInMemoryTelemetryAdapter({ capacity: 3 })
    for (let i = 0; i < 100_000; i++) {
      runtime.facade.captureMessage(String(i), 'info')
      history.captureMessage(String(i), 'info', {})
    }
    expect(runtime.memoryAdapter.events).toHaveLength(0)
    expect(history.events.map((event) => (event.kind === 'message' ? event.message : ''))).toEqual([
      '99997',
      '99998',
      '99999',
    ])
    history.clear()
    expect(history.events).toHaveLength(0)
  })

  it('skips replay-canceled setup and closes the installed binding on unmount', async () => {
    const runtime = createObservabilityRuntime()
    const manager = createTelemetryBindingManager(runtime)
    const dispose = vi.fn(async () => {})
    const create = vi.fn(() => ({ adapter: null, dispose }))
    manager.replace(create)()
    const cancel = manager.replace(create)
    await manager.settled()
    expect(create).toHaveBeenCalledTimes(1)
    cancel()
    await manager.settled()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('waits for old SDK shutdown before initializing a replacement', async () => {
    const manager = createTelemetryBindingManager(createObservabilityRuntime())
    let close!: () => void
    const old = manager.replace(() => ({
      adapter: null,
      dispose: () =>
        new Promise<void>((resolve) => {
          close = resolve
        }),
    }))
    await manager.settled()
    old()
    const next = vi.fn(() => ({ adapter: null, async dispose() {} }))
    const cancel = manager.replace(next)
    await Promise.resolve()
    expect(next).not.toHaveBeenCalled()
    close()
    await manager.settled()
    expect(next).toHaveBeenCalledOnce()
    cancel()
    await manager.settled()
  })
})

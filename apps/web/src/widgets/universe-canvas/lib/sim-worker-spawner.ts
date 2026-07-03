import type { SimWorkerLike, SimWorkerSpawner } from './sim-bridge.ts'

// Vite detects and bundles the worker module through this literal
// `new Worker(new URL(...), { type: 'module' })` pattern — keep it verbatim.
// Environments without Worker (SSR tests) fall back to the inline bridge.
export function createSimWorkerSpawner(): SimWorkerSpawner | null {
  if (typeof Worker !== 'function') return null
  return () =>
    new Worker(new URL('./universe-sim.worker.ts', import.meta.url), { type: 'module' }) as SimWorkerLike
}

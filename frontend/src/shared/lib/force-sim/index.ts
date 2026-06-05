// Public API for the force-sim lib.
export { createSim, tick, positions, alpha, isSettled } from './sim'
export type { SimState } from './sim'
export type { SimNode, SimEdge, SimGraph, SimParams } from './types'

/** Spawns the layout Web Worker (web platform). The pure core (createSim/tick) is
 *  imported directly on platforms without Workers (e.g. React Native). */
export function createSimWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
}

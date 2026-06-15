// Public API for the force-sim lib.
export { createSim, tick, advance, positions, alpha, isSettled } from './sim'
export type { SimState, CreateSimOptions } from './sim'
export type { SimNode, SimEdge, SimGraph, SimParams } from './types'
export { seedNearCluster } from './seed'
export type { SeedNeighbor } from './seed'

/** Spawns the layout Web Worker (web platform). The pure core (createSim/tick) is
 *  imported directly on platforms without Workers (e.g. React Native). */
export function createSimWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
}

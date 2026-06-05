// Web Worker wrapper (spec 07 §Worker 계약). Keeps the force layout off the main
// thread. It does NOT run its own rAF loop — the caller pumps it with `tick`
// messages (scheduling belongs to the caller; constitution §4 spirit). Coordinates
// are returned as a transferable ArrayBuffer (zero-copy).
//
// Note: this file uses worker globals (self / postMessage) — never DOM
// window/document — so the pure core (sim.ts / octree.ts / types.ts) stays
// mobile-shareable.
import { alpha, createSim, isSettled, positions, tick, type SimState } from './sim'
import type { SimGraph, SimParams } from './types'

type WorkerIn =
  | { type: 'init'; graph: SimGraph; params?: Partial<SimParams> }
  | { type: 'tick'; steps?: number }
  | { type: 'dispose' }

interface PositionsOut {
  type: 'positions'
  buffer: ArrayBuffer
  alpha: number
  settled: boolean
}

let state: SimState | null = null

// self.postMessage's worker signature (message, transfer[]) differs from Window's
// (message, targetOrigin); cast to the worker shape so the transfer list typechecks
// without pulling in the WebWorker lib.
const post = (msg: PositionsOut, transfer: Transferable[]): void =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(msg, transfer)

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':
      state = createSim(msg.graph, msg.params)
      break
    case 'tick': {
      if (!state) return
      tick(state, msg.steps ?? 1)
      const buf = positions(state) // fresh copy → safe to transfer
      post({ type: 'positions', buffer: buf.buffer, alpha: alpha(state), settled: isSettled(state) }, [
        buf.buffer,
      ])
      break
    }
    case 'dispose':
      state = null
      break
  }
}

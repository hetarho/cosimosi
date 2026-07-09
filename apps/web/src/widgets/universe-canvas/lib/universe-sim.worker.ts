import { createForceSimulation, type ForceSimulation } from '@cosimosi/force-sim'

import type { SimWorkerRequest, SimWorkerResponse } from '@cosimosi/universe'

// Module worker hosting the deterministic force sim off the render thread (§3.3). Buffers
// ping-pong as transferables: each tick writes coordinates into the caller-owned buffer
// (the tick(dt, output) form, so the sim's internal snapshot is never detached) and
// transfers it straight back. Any throw is reported as an 'error' message — a tick error
// still returns its buffer, so the bridge is never left waiting on a lost transferable.
let sim: ForceSimulation | null = null

const scope = globalThis as unknown as {
  onmessage: ((event: { data: SimWorkerRequest }) => void) | null
  postMessage(message: SimWorkerResponse, transfer: ArrayBuffer[]): void
}

scope.onmessage = (event) => {
  const message = event.data
  try {
    if (message.type === 'init') {
      sim = createForceSimulation(message.graph)
      return
    }
    const output = new Float32Array(message.buffer)
    if (sim) sim.tick(message.dt, output)
    scope.postMessage({ type: 'coords', buffer: message.buffer }, [message.buffer])
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (message.type === 'tick') {
      scope.postMessage({ type: 'error', message: detail, buffer: message.buffer }, [
        message.buffer,
      ])
    } else {
      scope.postMessage({ type: 'error', message: detail }, [])
    }
  }
}

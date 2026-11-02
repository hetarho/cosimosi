import type { ReactNode } from 'react'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryService } from '@cosimosi/api-client'
import { createClientCacheTestContext } from '@cosimosi/client-cache'

export interface FlowHarnessOptions {
  // What the server's SyncStatus answers; the flows' consent decision reads it.
  needsSync?: boolean
}

// createFlowHarness renders a flow controller the way a host does — the client-cache test context
// over an in-memory Connect router — so the reads a flow makes on mount resolve without a network.
// The paid or mutating call under test is injected through the controller's request port instead.
export function createFlowHarness({ needsSync = false }: FlowHarnessOptions = {}) {
  const transport = createRouterTransport(({ service }) => {
    service(MemoryService, {
      syncStatus: () => ({ needsSync, today: '2026-07-02', universeTime: '2026-07-01' }),
      getUniverse: () => ({ universeTime: '' }),
    })
  })
  const { queryClient } = createClientCacheTestContext({ transport })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TransportProvider>
  )
  return { transport, queryClient, wrapper }
}

// deferred hands a test the resolve/reject of a pending request so it can interleave events with it.
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

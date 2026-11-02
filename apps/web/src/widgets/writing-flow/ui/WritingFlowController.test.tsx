// @vitest-environment jsdom
import { type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryService } from '@cosimosi/api-client'
import { resetUniverseUserState, useDiaryDraftStore } from '@cosimosi/universe'
import { useProposalStore } from '@cosimosi/universe/testing'
import { useWritingFlowController } from '@cosimosi/universe/react/flows'

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
  resetUniverseUserState()
})

describe('shared writing controller', () => {
  it('sends one split and ignores its response after closing and reopening', async () => {
    let finish!: () => void
    let calls = 0
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        getUniverse: () => ({ memories: [], neurons: [], synapses: [], universeTime: '' }),
        splitDiary: () => {
          calls += 1
          return new Promise((resolve) => {
            finish = () =>
              resolve({
                memories: [{ name: 'old scene', mood: 'JOY', sourceText: 'old', neurons: [] }],
              })
          })
        },
      })
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    clients.push(client)
    const onError = vi.fn()
    const { result } = renderHook(() => useWritingFlowController({ onError }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TransportProvider transport={transport}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </TransportProvider>
      ),
    })
    act(() => result.current.open())
    act(() => useDiaryDraftStore.getState().setBody('a scene'))
    act(() => {
      result.current.runSplit()
      result.current.runSplit()
    })
    await waitFor(() => expect(calls).toBe(1))
    act(() => {
      result.current.close()
      result.current.open()
    })
    await act(async () => {
      finish()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(result.current.status).toBe('writing')
    expect(useProposalStore.getState().memories).toEqual([])
    expect(onError).not.toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { type ReactNode } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryService } from '@cosimosi/api-client'
import { ErrorToastContext } from '@cosimosi/errors/react'
import { measureAnchor, type SequenceRect } from '@cosimosi/sequence'
import { resetUniverseUserState, useDiaryDraftStore } from '@cosimosi/universe'
import { useProposalStore } from '@cosimosi/universe/testing'
import { useWritingFlowController } from '@cosimosi/universe/react/flows'

import { m } from '../../../shared/i18n/index.ts'
import { WritingFlowSheet } from './WritingFlowSheet.tsx'

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
  resetUniverseUserState()
  vi.restoreAllMocks()
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

describe('the writing-draft anchor', () => {
  it('measures a box that holds the draft fields and the split action', async () => {
    // ONB-17: the tour's draft step rings the body, the date and 별 쪼개기. The Dialog puts the split
    // action in its footer slot, apart from the fields, so the anchor has to reach both.
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        getUniverse: () => ({ memories: [], neurons: [], synapses: [], universeTime: '' }),
      })
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    clients.push(client)
    render(
      <TransportProvider transport={transport}>
        <QueryClientProvider client={client}>
          <ErrorToastContext.Provider value={vi.fn()}>
            <WritingFlowSheet />
          </ErrorToastContext.Provider>
        </QueryClientProvider>
      </TransportProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: m.universe_home_write() }))

    const split = screen.getByRole('button', { name: m.writing_flow_split_action() })
    const draft = document.querySelector(
      '[data-sequence-anchor="writing-draft"]',
    )?.firstElementChild
    expect(draft).toBeTruthy()
    // jsdom lays nothing out, so each element gets the box a phone-sized sheet would give it: the
    // fields high in the panel body, the split action low in the footer, right-aligned.
    const boxes = new Map<Element, SequenceRect>([
      [draft!, { x: 16, y: 120, width: 358, height: 320 }],
      [split.parentElement!, { x: 16, y: 760, width: 358, height: 44 }],
      [split, { x: 280, y: 760, width: 94, height: 44 }],
    ])
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const box = boxes.get(this) ?? { x: 0, y: 0, width: 0, height: 0 }
      return DOMRect.fromRect(box)
    })

    const ring = await measureAnchor('writing-draft')
    expect(ring).not.toBeNull()
    for (const part of [draft!, split]) {
      const box = boxes.get(part)!
      expect(ring!.x).toBeLessThanOrEqual(box.x)
      expect(ring!.y).toBeLessThanOrEqual(box.y)
      expect(ring!.x + ring!.width).toBeGreaterThanOrEqual(box.x + box.width)
      expect(ring!.y + ring!.height).toBeGreaterThanOrEqual(box.y + box.height)
    }
  })
})

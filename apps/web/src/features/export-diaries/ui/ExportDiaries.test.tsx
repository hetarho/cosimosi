// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ExportFormat, MemoryService } from '@cosimosi/api-client'

import { ErrorToastContext } from '../../../shared/model/index.ts'
import { ExportDiaries } from './ExportDiaries.tsx'

afterEach(cleanup)

describe('ExportDiaries', () => {
  it('calls CSV and MD imperatively, delivers the server filename, and caches no diary', async () => {
    const formats: ExportFormat[] = []
    const transport = createRouterTransport(({ service }) => {
      service(MemoryService, {
        export: (request) => {
          formats.push(request.format)
          return {
            content: new TextEncoder().encode('private diary'),
            contentType: 'text/plain',
            filename: request.format === ExportFormat.CSV ? 'diaries.csv' : 'diaries.md',
          }
        },
      })
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const createObjectUrl = vi.fn(() => 'blob:diaries')
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()

    render(
      <ErrorToastContext.Provider value={() => {}}>
        <TransportProvider transport={transport}>
          <QueryClientProvider client={queryClient}>
            <ExportDiaries />
          </QueryClientProvider>
        </TransportProvider>
      </ErrorToastContext.Provider>,
    )

    await user.click(screen.getByRole('button', { name: 'Export diaries' }))
    await waitFor(() => expect(formats).toEqual([ExportFormat.CSV]))
    await user.click(screen.getByRole('button', { name: 'Markdown' }))
    await user.click(screen.getByRole('button', { name: 'Export diaries' }))
    await waitFor(() => expect(formats).toEqual([ExportFormat.CSV, ExportFormat.MD]))

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(createObjectUrl).toHaveBeenCalledTimes(2)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:diaries')
    expect(click).toHaveBeenCalledTimes(2)
  })
})

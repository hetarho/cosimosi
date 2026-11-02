// @vitest-environment jsdom
import { Code, ConnectError } from '@connectrpc/connect'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorInfoSchema, type ViewSemanticResponse } from '@cosimosi/api-client'
import { invalidateUserScope } from '@cosimosi/auth/scope'
import { ERROR_REASONS } from '@cosimosi/errors/core'

import type { ViewSemanticInput } from '../view-semantic.ts'
import { createFlowHarness, deferred } from './flow-test-harness.tsx'
import { useGistViewController } from './use-gist-view.ts'

const shortfall = new ConnectError('refused', Code.ResourceExhausted, undefined, [
  {
    desc: ErrorInfoSchema,
    value: { reason: ERROR_REASONS.memoryInsufficientTwinkle, domain: 'memory' },
  },
])
const viewed = { text: 'the gist' } as ViewSemanticResponse

function renderGistView(request: (input: ViewSemanticInput) => Promise<ViewSemanticResponse>) {
  const ports = {
    onClose: vi.fn(),
    onError: vi.fn(),
    invalidateBalance: vi.fn(),
    invalidateAchievements: vi.fn(),
    requestEarnGuide: vi.fn(),
    request: vi.fn(request),
  }
  const { wrapper } = createFlowHarness()
  const rendered = renderHook(
    ({ episodicMemoryId }: { episodicMemoryId: string }) =>
      useGistViewController({ ...ports, episodicMemoryId }),
    { wrapper, initialProps: { episodicMemoryId: 'memory-1' } },
  )
  return { ports, ...rendered }
}

const operationIds = (ports: { request: { mock: { calls: [ViewSemanticInput][] } } }) =>
  ports.request.mock.calls.map(([input]) => input.operationId)

describe('useGistViewController', () => {
  // Unmount every rendered hook so a store subscription never outlives its test.
  afterEach(cleanup)

  it('reveals the gist after the paid read and refreshes balance and achievements', async () => {
    const { ports, result } = renderGistView(() => Promise.resolve(viewed))

    await act(() => result.current.proceed())

    expect(result.current.phase).toBe('revealed')
    expect(result.current.text).toBe('the gist')
    expect(ports.invalidateBalance).toHaveBeenCalledOnce()
    expect(ports.invalidateAchievements).toHaveBeenCalledOnce()
  })

  it('mints a new attempt after a known refusal and re-quotes on retry', async () => {
    const { ports, result } = renderGistView(() => Promise.reject(shortfall))

    await act(() => result.current.proceed())
    expect(result.current.phase).toBe('failed')
    expect(ports.requestEarnGuide).toHaveBeenCalledOnce()
    act(() => result.current.retry())
    expect(result.current.phase).toBe('quoting')
    await act(() => result.current.proceed())

    const [first, second] = operationIds(ports)
    expect(second).not.toBe(first)
  })

  it('retries an ambiguous failure under the same operation id without re-quoting', async () => {
    const { ports, result } = renderGistView(() =>
      Promise.reject(new ConnectError('down', Code.Unavailable)),
    )

    await act(() => result.current.proceed())
    await act(async () => {
      result.current.retry()
    })

    const [first, second] = operationIds(ports)
    expect(second).toBe(first)
    expect(result.current.phase).toBe('failed')
  })

  it('ignores close while the paid read is in flight', async () => {
    const pending = deferred<ViewSemanticResponse>()
    const { ports, result } = renderGistView(() => pending.promise)

    let run!: Promise<void>
    act(() => {
      run = result.current.proceed()
    })
    act(() => result.current.close())
    expect(ports.onClose).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve(viewed)
      await run
    })
    act(() => result.current.close())

    expect(ports.onClose).toHaveBeenCalledOnce()
  })

  it('drops the previous target’s completion and starts a fresh attempt on retarget', async () => {
    const pending = deferred<ViewSemanticResponse>()
    const { ports, result, rerender } = renderGistView(() => pending.promise)

    let run!: Promise<void>
    act(() => {
      run = result.current.proceed()
    })
    rerender({ episodicMemoryId: 'memory-2' })
    await act(async () => {
      pending.resolve(viewed)
      await run
    })

    expect(result.current.phase).toBe('quoting')
    expect(result.current.text).toBeNull()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })

  it('drops a completion that lands after the user scope was invalidated', async () => {
    const pending = deferred<ViewSemanticResponse>()
    const { ports, result } = renderGistView(() => pending.promise)

    let run!: Promise<void>
    act(() => {
      run = result.current.proceed()
    })
    invalidateUserScope()
    await act(async () => {
      pending.resolve(viewed)
      await run
    })

    expect(result.current.text).toBeNull()
    expect(ports.invalidateBalance).not.toHaveBeenCalled()
  })
})

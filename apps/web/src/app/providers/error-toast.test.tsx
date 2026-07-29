// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Code, ConnectError } from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorInfoSchema } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { ERROR_REASONS } from '@cosimosi/errors'
import { m, setActiveLocale } from '../../shared/i18n/index.ts'

import { useErrorToast } from '../../shared/model/index.ts'
import { WebToastProvider } from './toast-provider.tsx'

describe('the web error toast', () => {
  beforeEach(() => {
    setActiveLocale('en')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('renders reason copy without correlation-id noise and uses the generated duration', async () => {
    const { root, trigger } = await renderProvider(
      errorWithDetail(Code.ResourceExhausted, {
        reason: ERROR_REASONS.twinkleInsufficient,
        domain: 'twinkle',
        requestId: 'request-domain',
      }),
    )

    try {
      await trigger()
      expect(document.body.textContent).toContain(m.error_twinkle_insufficient())
      expect(document.body.textContent).not.toContain('request-domain')

      await act(() => vi.advanceTimersByTimeAsync(VALUES.errors.toastAutoDismissMs - 1))
      expect(document.body.textContent).toContain(m.error_twinkle_insufficient())
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(document.body.textContent).not.toContain(m.error_twinkle_insufficient())
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('renders the internal correlation id but never debug detail', async () => {
    const { root, trigger } = await renderProvider(
      errorWithDetail(Code.Internal, {
        reason: ERROR_REASONS.internal,
        domain: 'platform',
        requestId: 'request-web-internal',
        debugDetail: 'database exploded',
      }),
    )

    try {
      await trigger()
      expect(document.body.textContent).toContain('request-web-internal')
      expect(document.body.textContent).not.toContain('database exploded')
    } finally {
      await act(async () => root.unmount())
    }
  })
})

async function renderProvider(error: ConnectError) {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  const root = createRoot(container)
  let showError: (error: unknown) => void = () => {}

  function Probe() {
    showError = useErrorToast()
    return null
  }

  await act(async () => {
    root.render(
      // The error path pushes into the shared queue now, so the host that renders the one Toast has
      // to be present — the assertions below are unchanged, which is the point: no consumer of
      // useErrorToast knows the toast moved.
      // The host owns the one Toast AND wires the error seam into it, so mounting it is the whole
      // wiring. The assertions below are unchanged: no useErrorToast consumer knows the toast moved.
      <WebToastProvider>
        <Probe />
      </WebToastProvider>,
    )
  })

  return {
    root,
    trigger: () => act(async () => showError(error)),
  }
}

function errorWithDetail(
  code: Code,
  detail: {
    reason: string
    domain: string
    requestId: string
    debugDetail?: string
  },
) {
  return new ConnectError('safe message', code, undefined, [
    { desc: ErrorInfoSchema, value: detail },
  ])
}

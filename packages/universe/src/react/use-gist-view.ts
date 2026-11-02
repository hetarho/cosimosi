import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import type { ViewSemanticResponse } from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors/core'
import { useMachine } from '@cosimosi/state-machine/react'
import { gistViewMachine, type GistViewPhase } from '../gist-view.machine.ts'
import { classifyPaidActionError, createPaidActionSession } from '../paid-action-session.ts'
import { requestViewSemantic, type ViewSemanticInput } from '../view-semantic.ts'
import { useCompletionScope } from './use-completion-scope.ts'

export interface GistViewPorts {
  episodicMemoryId: string
  onClose(): void
  onError(error: unknown): void
  invalidateBalance(): void
  invalidateAchievements(): void
  requestEarnGuide(): void
  // The paid read itself; defaults to the ViewSemantic RPC on the ambient transport. Tests inject it.
  request?(input: ViewSemanticInput): Promise<ViewSemanticResponse>
}

// useGistViewController is the 요지 보기 paid read ([R8][G4]), priced before it happens: the cost
// gate shows the quote and, only on its proceed, ViewSemantic fires — the spend the server gate
// charges — then the pregenerated gist text is revealed read-only ([I2]). The read carries a client
// operation id: while it is in flight the view is non-dismissible and re-proceed is suppressed, and
// an ambiguous-failure retry reuses the id so the server replays the committed receipt — revealing
// the paid text without a second debit. A shortfall opens the charge path rather than dead-ending.
export function useGistViewController(ports: GistViewPorts) {
  const { episodicMemoryId } = ports
  const [snapshot, send, actor] = useMachine(gistViewMachine)
  const phase = snapshot.value as GistViewPhase
  const paidSession = useMemo(() => createPaidActionSession(), [])
  const capture = useCompletionScope()
  const transport = useTransport()
  // The ports change identity with every host render; the read takes them at call time.
  const latest = useRef({ ports, transport })
  useLayoutEffect(() => {
    latest.current = { ports, transport }
  })

  // One operation id per view intent, keyed on the memory alone: the server picks the rung a read
  // reaches. A retarget restarts the view and invalidates the previous attempt, so it can never
  // replay the previous gist's receipt.
  useEffect(() => {
    const attempt = paidSession.begin(episodicMemoryId)
    send({ type: 'START', attempt })
    return () => paidSession.invalidate(attempt)
  }, [paidSession, episodicMemoryId, send])

  const proceed = useCallback(async () => {
    const { attempt } = actor.getSnapshot().context
    const state = actor.getSnapshot().value
    if (!attempt || (state !== 'quoting' && state !== 'failed')) return
    if (!paidSession.start(attempt)) return
    const isCurrent = capture()
    const isActive = () => isCurrent() && paidSession.isActive(attempt)
    const { ports: current, transport: activeTransport } = latest.current
    const request =
      current.request ?? ((input: ViewSemanticInput) => requestViewSemantic(activeTransport, input))

    send({ type: 'PROCEED' })
    try {
      const response = await request({
        episodicMemoryId: attempt.targetKey,
        operationId: attempt.operationId,
      })
      if (!isActive()) return
      current.invalidateBalance()
      // The balance is refreshed on BOTH paths because a refused paid action can still have moved it;
      // achievements are refreshed only on success: a failed read recorded no progress.
      current.invalidateAchievements()
      send({ type: 'REVEALED', text: response.text })
    } catch (error) {
      if (!isActive()) return
      current.invalidateBalance()
      current.onError(error)
      // Known refusal (e.g. a stale-quote shortfall) committed nothing → the next attempt is a fresh
      // spend under a new id, re-quoted. Ambiguous failure MAY have committed → keep the id so the
      // retry replays the receipt directly, without re-quoting a now-depleted balance.
      if (classifyPaidActionError(error) === 'known-refusal') {
        paidSession.finish(attempt)
        send({ type: 'REFUSED', attempt: paidSession.begin(attempt.targetKey) })
        if (classifyErrorRecovery(error) === 'earn') current.requestEarnGuide()
        return
      }
      send({ type: 'AMBIGUOUS' })
    } finally {
      paidSession.finish(attempt)
    }
  }, [actor, paidSession, capture, send])

  // Retry after a failure: an ambiguous one replays the same operation id; a known refusal returns
  // to the cost gate under the fresh attempt.
  const retry = useCallback(() => {
    if (actor.getSnapshot().context.failure === 'ambiguous') {
      void proceed()
      return
    }
    send({ type: 'REQUOTE' })
  }, [actor, proceed, send])

  // Close is inert while the paid read is in flight: the close button, backdrop and Escape cannot
  // dismiss a busy view.
  const close = useCallback(() => {
    if (actor.getSnapshot().value === 'viewing') return
    const { attempt } = actor.getSnapshot().context
    if (attempt) paidSession.invalidate(attempt)
    latest.current.ports.onClose()
  }, [actor, paidSession])

  return {
    phase,
    text: snapshot.context.text,
    busy: phase === 'viewing',
    failed: phase === 'failed',
    proceed,
    retry,
    close,
  }
}

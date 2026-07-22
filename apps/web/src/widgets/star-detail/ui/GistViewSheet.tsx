import { useCallback, useEffect, useRef, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'

import { Button, Dialog } from '@cosimosi/ui'
import {
  classifyPaidActionError,
  createPaidActionSession,
  requestViewSemantic,
  useChargeRequestStore,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '../../../entities/twinkle/index.ts'
import { SpendCostDisplay, gistViewSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/star-detail ui ([R8][G4], A5): the gist-view (요지 보기) surface, priced before it
// happens. Selecting a neocortical gist body opens this over the canvas; the cost display shows the
// gist quote and, only on its proceed, the ViewSemantic read fires — the spend the server gate
// charges — then the pregenerated gist text is revealed read-only ([I2]) and the balance refetched.
// The paid read carries a client operation id (A2): while it is in flight the sheet is
// non-dismissible and re-proceed is suppressed (A4), and an ambiguous-failure retry reuses the id so
// the server replays the committed receipt — revealing the paid text without a second debit. A
// shortfall opens the charge sheet rather than dead-ending (A4).
export function GistViewSheet({
  episodicMemoryId,
  stage,
  onClose,
}: {
  episodicMemoryId: string
  stage: number
  onClose: () => void
}) {
  const transport = useTransport()
  const requestCharge = useChargeRequestStore((state) => state.request)
  const invalidateBalance = useInvalidateTwinkleBalance()

  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorKind, setErrorKind] = useState<'ambiguous' | 'known-refusal' | null>(null)
  const sessionRef = useRef<PaidActionSession | null>(null)
  if (sessionRef.current === null) sessionRef.current = createPaidActionSession()
  const paidSession = sessionRef.current
  const [attempt, setAttempt] = useState<PaidActionAttempt | null>(null)
  const targetKey = `${episodicMemoryId}:${stage}`

  // One operation id per view intent; reset (with the view state) when the target gist changes, so
  // a retarget never replays the previous gist's receipt under a stale id.
  useEffect(() => {
    const nextAttempt = paidSession.begin(targetKey)
    setText(null)
    setBusy(false)
    setErrorKind(null)
    setAttempt(nextAttempt)
    return () => paidSession.invalidate(nextAttempt)
  }, [paidSession, targetKey])

  const proceed = useCallback(async () => {
    if (!attempt || attempt.targetKey !== targetKey || busy) return
    const activeAttempt = attempt
    if (!paidSession.start(activeAttempt)) return
    setBusy(true)
    setErrorKind(null)
    try {
      const response = await requestViewSemantic(transport, {
        episodicMemoryId,
        stage,
        operationId: activeAttempt.operationId,
      })
      if (!paidSession.isActive(activeAttempt)) return
      setText(response.text)
      invalidateBalance()
    } catch (error) {
      if (!paidSession.isActive(activeAttempt)) return
      invalidateBalance()
      // Known refusal (e.g. a stale-quote shortfall) committed nothing → the next attempt is a
      // fresh spend under a new id, re-quoted. Ambiguous failure MAY have committed → keep the id
      // so the retry replays the receipt directly (§ retry button), revealing the paid gist without
      // a second debit and without re-quoting a now-depleted balance (A2/A5).
      const kind = classifyPaidActionError(error)
      if (kind === 'known-refusal') {
        if (paidSession.finish(activeAttempt)) setBusy(false)
        setAttempt(paidSession.begin(targetKey))
      }
      setErrorKind(kind)
    } finally {
      if (paidSession.finish(activeAttempt)) setBusy(false)
    }
  }, [attempt, targetKey, busy, paidSession, transport, episodicMemoryId, stage, invalidateBalance])

  // Close is inert while the paid read is in flight (A4): the close button, backdrop, and Escape
  // cannot dismiss a busy view.
  const close = useCallback(() => {
    if (busy) return
    if (attempt) paidSession.invalidate(attempt)
    onClose()
  }, [attempt, busy, paidSession, onClose])

  return (
    <Dialog open onClose={close} title={m.gist_view_title()} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-4">
        {text !== null ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
            <div className="flex justify-end">
              <Button color="neutral" size="sm" onClick={close}>
                {m.common_dismiss()}
              </Button>
            </div>
          </>
        ) : busy ? (
          <p className="text-sm text-text-muted">{m.gist_view_loading()}</p>
        ) : errorKind !== null ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{m.gist_view_error()}</p>
            <div className="flex justify-end gap-2">
              <Button color="neutral" size="sm" onClick={close}>
                {m.twinkle_cost_cancel()}
              </Button>
              {/* Ambiguous failure → retry replays the same operation id directly (recovers a
                  committed-but-lost gist, no re-quote/second debit); a known refusal → re-show the
                  fresh cost gate so a real shortfall surfaces the charge path (A2/A5). */}
              <Button
                color="primary"
                size="sm"
                onClick={errorKind === 'ambiguous' ? proceed : () => setErrorKind(null)}
              >
                {m.common_retry()}
              </Button>
            </div>
          </div>
        ) : (
          <SpendCostDisplay
            pending={gistViewSpend(episodicMemoryId, stage)}
            onProceed={proceed}
            onCancel={close}
            onCharge={requestCharge}
          />
        )}
      </div>
    </Dialog>
  )
}

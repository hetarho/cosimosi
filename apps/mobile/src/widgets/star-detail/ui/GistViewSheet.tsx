import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { useChargeRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import {
  classifyPaidActionError,
  createPaidActionSession,
  requestViewSemantic,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { SpendCostDisplay, gistViewSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/star-detail ui (RN fork, [R8][G4], A5): the gist-view (요지 보기) surface, priced before
// it happens. The cost display shows the gist quote and, only on its proceed, the ViewSemantic read
// fires — the spend the server gate charges — then the pregenerated gist text is revealed read-only
// ([I2]) and the balance refetched. The paid read carries a client operation id (A2): while in
// flight the sheet is non-dismissible and re-proceed is suppressed (A4), and an ambiguous-failure
// retry reuses the id so the server replays the receipt (revealing the paid text without a second
// debit). A shortfall opens the charge sheet rather than dead-ending (A4). Shares model with web.
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

  // One operation id per view intent; reset (with the view state) when the target gist changes.
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
      // Ambiguous → keep the id so the retry replays the committed receipt directly (no re-quote);
      // known refusal → fresh id, re-quote (A2/A5).
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

  const close = useCallback(() => {
    if (busy) return
    if (attempt) paidSession.invalidate(attempt)
    onClose()
  }, [attempt, busy, paidSession, onClose])

  return (
    <Dialog open onClose={close} title={m.gist_view_title()} closeLabel={m.common_dismiss()}>
      <View style={styles.body}>
        {text !== null ? (
          <>
            <Text style={styles.text}>{text}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={close}>
                {m.common_dismiss()}
              </Button>
            </View>
          </>
        ) : busy ? (
          <Text style={styles.muted}>{m.gist_view_loading()}</Text>
        ) : errorKind !== null ? (
          <View style={styles.body}>
            <Text style={styles.muted}>{m.gist_view_error()}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={close}>
                {m.twinkle_cost_cancel()}
              </Button>
              {/* Ambiguous → retry replays the same operation id directly; known refusal → re-quote. */}
              <Button
                color="primary"
                size="sm"
                onPress={errorKind === 'ambiguous' ? proceed : () => setErrorKind(null)}
              >
                {m.common_retry()}
              </Button>
            </View>
          </View>
        ) : (
          <SpendCostDisplay
            pending={gistViewSpend(episodicMemoryId, stage)}
            onProceed={proceed}
            onCancel={close}
            onCharge={requestCharge}
          />
        )}
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[4] },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})

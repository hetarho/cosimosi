import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { Button, Dialog, tokens } from '@cosimosi/ui'
import { requestViewSemantic, useChargeRequestStore } from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '../../../entities/twinkle/index.ts'
import { SpendCostDisplay, gistViewSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/star-detail ui (RN fork, [R8][G4], A5): the gist-view (요지 보기) surface, priced
// before it happens. Selecting a neocortical gist body opens this over the canvas; the cost
// display shows the gist quote and, only on its proceed, the ViewSemantic read fires — the
// spend the server gate charges — then the pregenerated gist text is revealed read-only
// ([I2]) and the balance refetched. A shortfall opens the charge sheet rather than
// dead-ending (A4). The cost display never calls the spend; this sheet fires it on proceed.
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
  const [errored, setErrored] = useState(false)

  const proceed = useCallback(async () => {
    setBusy(true)
    setErrored(false)
    try {
      const response = await requestViewSemantic(transport, { episodicMemoryId, stage })
      setText(response.text)
      invalidateBalance()
    } catch {
      // A refused view (e.g. a stale-quote shortfall) charged nothing; refetch so the
      // re-shown cost gate re-quotes fresh, then route back to it (never a dead end, A4).
      invalidateBalance()
      setErrored(true)
    } finally {
      setBusy(false)
    }
  }, [transport, episodicMemoryId, stage, invalidateBalance])

  return (
    <Dialog open onClose={onClose} title={m.gist_view_title()} closeLabel={m.common_dismiss()}>
      <View style={styles.body}>
        {text !== null ? (
          <>
            <Text style={styles.text}>{text}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={onClose}>
                {m.common_dismiss()}
              </Button>
            </View>
          </>
        ) : busy ? (
          <Text style={styles.muted}>{m.gist_view_loading()}</Text>
        ) : errored ? (
          <View style={styles.body}>
            <Text style={styles.muted}>{m.gist_view_error()}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={onClose}>
                {m.twinkle_cost_cancel()}
              </Button>
              {/* Retry re-shows the cost gate (fresh quote), not a blind re-spend — a real
                  shortfall then surfaces the charge path rather than failing again. */}
              <Button color="primary" size="sm" onPress={() => setErrored(false)}>
                {m.common_retry()}
              </Button>
            </View>
          </View>
        ) : (
          <SpendCostDisplay
            pending={gistViewSpend(episodicMemoryId)}
            onProceed={proceed}
            onCancel={onClose}
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

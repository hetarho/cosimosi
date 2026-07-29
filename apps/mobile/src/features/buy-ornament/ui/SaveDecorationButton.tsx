import { StyleSheet, Text, View } from 'react-native'

import { saveVerdict, useOrnamentPreviewStore, type Ornament } from '@cosimosi/store'
import { ornamentName } from '@cosimosi/store/i18n'
import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { Button, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

// features/buy-ornament ui (native fork): the one commit action, and the one place a refusal is
// explained. It reads the GENERAL balance alone — an ornament cannot be bought with today's recall
// allowance, so SMALL appears nowhere here ([P9]) — from the shared mirror, not a second GetBalance.
export function SaveDecorationButton({
  catalog,
  saving,
  failureReason,
  onSave,
}: {
  readonly catalog: readonly Ornament[]
  readonly saving: boolean
  readonly failureReason: string | null
  readonly onSave: () => void
}) {
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  const confirmed = useOrnamentPreviewStore((state) => state.confirmed)
  // The mirror keeps the balance as bigint (the wire's int64); the verdict's arithmetic is small
  // display sums, so it is narrowed once here rather than threaded as bigint through pure math.
  const generalBalance = Number(useTwinkleBalanceStore((state) => state.general))
  const balanceLoaded = useTwinkleBalanceStore((state) => state.loaded)
  const verdict = saveVerdict({ catalog, previewed, confirmed, generalBalance, balanceLoaded })

  return (
    <View style={styles.footer}>
      {verdict.kind === 'shortfall' ? (
        <Text style={styles.notice}>
          {m.store_shortfall_notice({
            name: ornamentName(verdict.ornamentId),
            amount: verdict.amount,
          })}
        </Text>
      ) : null}
      {verdict.kind === 'locked' ? (
        <Text style={styles.notice}>
          {m.store_locked_notice({ name: ornamentName(verdict.ornamentId) })}
        </Text>
      ) : null}
      {failureReason ? <Text style={styles.failure}>{failureReason}</Text> : null}
      <Button
        color="primary"
        loading={saving}
        disabled={saving || verdict.kind === 'shortfall' || verdict.kind === 'locked'}
        onPress={onSave}
      >
        {saving ? m.store_saving_notice() : null}
        {!saving && verdict.kind === 'ready'
          ? m.store_save_action_priced({ amount: verdict.amount })
          : null}
        {!saving && verdict.kind !== 'ready' ? m.store_save_action() : null}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { gap: tokens.spacing[2] },
  notice: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  failure: { color: tokens.color.danger, fontSize: tokens.fontSize.xs },
})

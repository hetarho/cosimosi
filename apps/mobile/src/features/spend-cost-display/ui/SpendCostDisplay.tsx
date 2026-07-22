import { StyleSheet, Text, View } from 'react-native'

import { SpendKind } from '@cosimosi/api-client'
import type { PendingSpend } from '@cosimosi/twinkle'
import { useSpendQuote } from '@cosimosi/twinkle/react'
import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

function costLabel(kind: SpendKind): string {
  if (kind === SpendKind.GIST_VIEW) return m.twinkle_cost_gist_label()
  if (kind === SpendKind.DIARY_RECALL) return m.twinkle_cost_diary_label()
  return m.twinkle_cost_recall_label()
}

// features/spend-cost-display ui (RN fork, [G4], CC3): the reusable price surface the recall
// and gist-view flows compose before spending. It renders the server quote verbatim — the
// price, whether the balance covers it, and on a shortfall the amount short + a charge
// affordance rather than a dead end ([G3]). It returns a decision only through the
// callbacks and never calls spend itself (A4). Shares model/api with web verbatim.
export function SpendCostDisplay({
  pending,
  onProceed,
  onCancel,
  onCharge,
}: {
  pending: PendingSpend
  onProceed: () => void
  onCancel: () => void
  onCharge: () => void
}) {
  const query = useSpendQuote(pending)
  const quote = query.data

  if (query.isError) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>{m.twinkle_cost_error()}</Text>
        <View style={styles.actions}>
          <Button color="neutral" size="sm" onPress={onCancel}>
            {m.twinkle_cost_cancel()}
          </Button>
        </View>
      </View>
    )
  }

  if (!quote) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>{m.twinkle_cost_loading()}</Text>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.muted}>{costLabel(pending.kind)}</Text>
        <Text style={styles.figure}>{String(quote.cost)}</Text>
      </View>

      {quote.covered ? (
        <View style={styles.actions}>
          <Button color="neutral" size="sm" onPress={onCancel}>
            {m.twinkle_cost_cancel()}
          </Button>
          <Button color="primary" size="sm" onPress={onProceed}>
            {m.twinkle_cost_proceed()}
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.muted}>{m.twinkle_cost_shortfall_label()}</Text>
            <Text style={styles.shortfall}>{String(quote.shortfall)}</Text>
          </View>
          <Text style={styles.muted}>{m.twinkle_cost_shortfall_notice()}</Text>
          <View style={styles.actions}>
            <Button color="neutral" size="sm" onPress={onCancel}>
              {m.twinkle_cost_cancel()}
            </Button>
            <Button color="primary" size="sm" onPress={onCharge}>
              {m.twinkle_cost_charge()}
            </Button>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: tokens.spacing[3],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    padding: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  figure: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '500' },
  shortfall: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})

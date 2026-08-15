import { Pressable, StyleSheet, Text } from 'react-native'

import { ornamentCost, type Ornament } from '@cosimosi/store'
import { ornamentName } from '@cosimosi/store/i18n'
import { m } from '../../../shared/i18n/index.ts'
import { tokens } from '@cosimosi/ui'

// features/preview-ornament ui (native fork of the web row): one catalog row, where what it says
// about ownership is a price or its absence and nothing else ([P7]) — and the live row says so in its
// treatment rather than in a word beside it. Every row is selectable, owned
// or not — picking one applies it to the real universe at once ([P6]).
export function OrnamentRow({
  ornament,
  applied,
  disabled = false,
  onPreview,
}: {
  readonly ornament: Ornament
  readonly applied: boolean
  /** True while a save is in flight: what is being bought must not change under the request. */
  readonly disabled?: boolean
  readonly onPreview: (ornament: Ornament) => void
}) {
  const cost = ornamentCost(ornament)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: applied, disabled }}
      disabled={disabled}
      onPress={() => onPreview(ornament)}
      style={[styles.row, applied && styles.rowApplied, disabled && styles.rowDisabled]}
    >
      <Text style={[styles.name, applied && styles.nameApplied]} numberOfLines={1}>
        {ornamentName(ornament.id)}
      </Text>
      <Text style={[styles.meta, applied && styles.metaApplied]}>
        {/* A price never disappears because a row is being previewed: "absence of a price means you
            own it" only holds if the price stays put while the user looks at the sky it buys. */}
        {cost.kind === 'price' ? m.store_price_amount({ amount: cost.amount }) : null}
        {cost.kind === 'condition' ? m.store_condition_locked() : null}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  // The live choice reads in the accent, lit from the glyphs — the native form of the web's
  // `.item-selected` (the held version of the text button's highlight). A one-step surface change
  // was not findable at a glance over a moving universe. RN has no `color-mix`, so the tint is the
  // raised surface and the accent does the work in the ink.
  rowApplied: { backgroundColor: tokens.color['surface-raised'] },
  rowDisabled: { opacity: 0.6 },
  name: { flexShrink: 1, color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  nameApplied: {
    color: tokens.color.primary,
    fontWeight: '500',
    textShadowColor: tokens.color.primary,
    textShadowRadius: 8,
  },
  meta: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  metaApplied: { color: tokens.color.primary },
})

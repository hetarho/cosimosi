import { StyleSheet, Text, View } from 'react-native'

import { useTwinkleBalanceFigures } from '@cosimosi/twinkle/react'
import { TwinkleGeneralIcon, TwinkleSmallIcon, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// entities/twinkle ui (RN fork, [G2][G5]): the balance reading. SMALL (today's recall-only allowance)
// and GENERAL (the universal permanent reserve) are always distinct — the same glyph at two densities
// — and there is NO SUMMED FIGURE: beside the two it only repeats them, and a total would overstate
// spending power ([G5][P9]). Figures only: no meaning-layer or placement control ([I11]).
//
// Two forms from the same shared figures and their placeholder:
// - `stacked`: icons and figures drawn straight over the sky, each name shown only when `labelled` —
//   the corner reading, whose names are one tap away.
// - `list`: each figure named beside its own glyph, at rest on a surface that has room for them.
export function TwinkleBalance({
  form,
  labelled = false,
}: {
  readonly form: 'stacked' | 'list'
  readonly labelled?: boolean
}) {
  const { small, general } = useTwinkleBalanceFigures()
  const kinds = [
    { icon: TwinkleSmallIcon, label: m.twinkle_balance_small_label(), value: small },
    { icon: TwinkleGeneralIcon, label: m.twinkle_balance_general_label(), value: general },
  ]

  if (form === 'list') {
    return (
      <View style={styles.list}>
        {kinds.map(({ icon: Icon, label, value }) => (
          <View key={label} style={styles.line}>
            <View style={styles.term}>
              <Icon color={tokens.color['text-muted']} />
              <Text style={styles.listLabel}>{label}</Text>
            </View>
            <Text style={styles.listFigure}>{value}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.stack}>
      {kinds.map(({ icon: Icon, label, value }) => (
        <View key={label} style={styles.entry}>
          {labelled ? <Text style={styles.label}>{label}</Text> : null}
          <Icon color={tokens.color['text-muted']} />
          <Text style={styles.figure}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { alignItems: 'flex-end', gap: tokens.spacing[1], paddingVertical: tokens.spacing[1] },
  entry: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  figure: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.sm,
    fontWeight: '500',
    // The sky behind is bright wherever the nebula is, and there is no surface to sit on.
    textShadowColor: tokens.color.bg,
    textShadowRadius: 6,
  },
  list: { gap: tokens.spacing[2] },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  term: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  listLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  listFigure: { color: tokens.color.text, fontSize: tokens.fontSize.base },
})

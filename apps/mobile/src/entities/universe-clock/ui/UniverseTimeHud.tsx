import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { useUniverseClockStore } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

export interface UniverseTimeHudProps {
  /** While the acceleration plays, the widget hands in the sweeping date; the store value resumes after. */
  overrideTime?: string | null
}

// The persistent "우리 우주의 시간" HUD ([T6]) — the RN fork of the web reading (§3.5, primitive
// differs: RN View/Text vs DOM). The last diary date, or the empty-universe line while the clock is
// unborn. A label and a value only — no control sits here ([I10][I11]).
//
// Bare type, not a chip. A surface behind it made the one reading that belongs to the PLACE look like
// another control in the chrome; the sky is what it is written on. Legibility over a bright nebula
// comes from a shadow on the glyphs instead of a panel under them.
export function UniverseTimeHud({ overrideTime = null }: UniverseTimeHudProps) {
  const currentUniverseTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const shown = overrideTime ?? currentUniverseTime
  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.label}>{m.universe_time_hud_label()}</Text>
      {shown ? (
        <Text style={styles.value}>{shown}</Text>
      ) : (
        <Text style={styles.empty}>{m.universe_time_hud_empty()}</Text>
      )}
    </View>
  )
}

// The sky behind is bright wherever the nebula is, and there is no surface to sit on.
const ink = { textShadowColor: tokens.color.bg, textShadowRadius: 6 } as const

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label: { ...ink, color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  value: {
    ...ink,
    color: tokens.color.text,
    fontSize: tokens.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  empty: { ...ink, color: tokens.color['text-subtle'], fontSize: tokens.fontSize.sm },
})

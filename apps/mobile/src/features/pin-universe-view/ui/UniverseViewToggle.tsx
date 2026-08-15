import { StyleSheet, Text, View } from 'react-native'

import { FreeViewIcon, IconButton, PinnedViewIcon, tokens } from '@cosimosi/ui'
import { useUniverseViewStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/pin-universe-view: the mirror of the web slice (§3.5) — the one control that says how the
// universe is being held, 고정 모드 or 자유 모드. It writes the shared view store and nothing else;
// the camera reads that store inside the canvas.
//
// The glyph says which mode is ON and the word beside it says the same again. There is no hover on
// touch, so the accessible name carries both that visible STATE word and the ACTION. `selected`
// carries the same state non-visually.
export function UniverseViewToggle() {
  const mode = useUniverseViewStore((state) => state.mode)
  const toggle = useUniverseViewStore((state) => state.toggle)
  const pinned = mode === 'pinned'
  const state = pinned ? m.universe_view_pinned() : m.universe_view_free()
  const action = pinned ? m.universe_view_free_action() : m.universe_view_pin_action()

  return (
    <View style={styles.root}>
      <IconButton
        variant="outlined"
        color="neutral"
        label={`${state}. ${action}`}
        accessibilityState={{ selected: pinned }}
        icon={pinned ? <PinnedViewIcon /> : <FreeViewIcon />}
        onPress={toggle}
      />
      <Text style={styles.mode}>{state}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  mode: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})

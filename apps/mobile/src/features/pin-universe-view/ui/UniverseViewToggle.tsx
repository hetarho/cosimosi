import { StyleSheet, Text, View } from 'react-native'

import { FreeViewIcon, IconButton, PinnedViewIcon, tokens } from '@cosimosi/ui'
import { useUniverseViewStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/pin-universe-view: the mirror of the web slice (§3.5) — the one control that says how the
// universe is being held, 고정 모드 or 자유 모드. It writes the shared view store and nothing else;
// the camera reads that store inside the canvas.
//
// The glyph says which mode is ON and the word beside it says the same again. There is no hover on
// touch, so the button's `label` carries the ACTION as its whole accessible name, and `selected`
// carries the state a sighted viewer gets from the fill.
export function UniverseViewToggle() {
  const mode = useUniverseViewStore((state) => state.mode)
  const toggle = useUniverseViewStore((state) => state.toggle)
  const pinned = mode === 'pinned'

  return (
    <View style={styles.root}>
      <IconButton
        variant="outlined"
        color="neutral"
        label={pinned ? m.universe_view_free_action() : m.universe_view_pin_action()}
        accessibilityState={{ selected: pinned }}
        icon={pinned ? <PinnedViewIcon /> : <FreeViewIcon />}
        onPress={toggle}
      />
      <Text style={styles.mode}>{pinned ? m.universe_view_pinned() : m.universe_view_free()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  mode: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})

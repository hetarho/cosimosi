import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The reserved [P4] staging slot (RN mirror of the web ui): it names the non-meaning layers
// (background · theme · effect · camera mood) and states the boundary, and deliberately renders NO
// control — the guarantee that staging can never touch "color = emotion", a star's emotion, or any
// position/strength is structural, not copy ([P2][I11]). What later staging work makes
// user-choosable is the build-time `rendering.active_skin` / `useSkin` seam the rendering foundation ([14]) reserved
// (packages/3d-renderer) — named here, not consumed, not modified.
export function StagingSection() {
  return (
    <View accessibilityState={{ disabled: true }} style={styles.root}>
      <Text style={styles.items}>{m.settings_staging_items()}</Text>
      <Text style={styles.note}>{m.settings_staging_notice()}</Text>
      <Text style={styles.note}>{m.settings_staging_boundary()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 8, opacity: 0.6 },
  items: { color: tokens.color.text, fontSize: 14 },
  note: { color: tokens.color['text-muted'], fontSize: 14 },
})

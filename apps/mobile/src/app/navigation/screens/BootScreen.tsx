import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { m } from '@cosimosi/i18n'
import { tokens } from '@cosimosi/ui'

/**
 * Neutral splash held while the session seam settles (`bootstrapping`/`refreshing`). It owns no
 * navigation: the gate (NavigationRoot) swaps to the login or universe stack from the same session
 * snapshot once it settles, so there is no signed-out flash and no route to return to here.
 */
export function BootScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={tokens.color.primary} />
      <Text style={styles.label}>{m.common_loading()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  label: { color: tokens.color['text-muted'], fontSize: 14 },
})

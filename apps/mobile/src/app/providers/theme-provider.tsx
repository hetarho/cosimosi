import { type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

/**
 * Theme/design-system seam mount for the native surface. The shared theme store
 * (@cosimosi/ui `useTheme`) is global, so this provider holds no state; it gives
 * the shell its token-backed background and is the documented place where future
 * theme→surface mapping (light/dark, reduced-motion) is applied. Feature slices
 * read theme through `useTheme`, never by reaching into this provider.
 */
export function MobileThemeProvider({ children }: { children?: ReactNode }) {
  return <View style={styles.surface}>{children}</View>
}

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: tokens.color.bg },
})

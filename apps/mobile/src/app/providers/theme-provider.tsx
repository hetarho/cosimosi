import { type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

/**
 * Design-system seam mount for the native surface. The active theme is static data resolved in
 * `@cosimosi/ui` (`palette.ts` → `tokens`), so this provider holds no state; it gives the shell its
 * token-backed surface and is the documented place where future presentation→surface mapping is
 * applied.
 */
export function MobileThemeProvider({ children }: { children?: ReactNode }) {
  return <View style={styles.surface}>{children}</View>
}

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: tokens.color.bg },
})

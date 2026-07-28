import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Badge, Button, defaultThemeKey, themes, tokens } from '@cosimosi/ui'

import { useScreenInsets } from '../../../shared/native/index.ts'

import { FoundationsPanel } from '../lib/foundations-panel.tsx'
import { PatternsPanel } from '../lib/patterns-panel.tsx'
import { PrimitivesPanel } from '../lib/primitives-panel.tsx'
import { T } from '../lib/showcase-copy.ts'
import { UniversePanel } from '../lib/universe-panel.tsx'

/**
 * The native design showcase — the mobile half of the surface a design review reads.
 *
 * Same order as the web page (tokens, then every primitive, then the composed chrome) so the two can
 * be read side by side and the parity dimension is a comparison rather than a memory test. One long
 * scroll rather than a tab set, for the same reason: the questions a review asks are comparisons
 * across sections.
 *
 * It reads no product data and needs no session or GPU, so it opens instantly and reproduces
 * exactly. Like `/test` it sits behind the diagnostics gate and never ships to a user.
 */
export function DesignShowcasePage({ onBack }: { onBack: () => void }) {
  const activeTheme = themes[defaultThemeKey]
  const insets = useScreenInsets()
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + tokens.spacing[4],
            paddingBottom: insets.bottom + tokens.spacing[8],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.themeRow}>
            <Badge variant="primary">{activeTheme.label}</Badge>
            <Button variant="text" color="neutral" size="sm" onPress={onBack}>
              {T.back}
            </Button>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {T.title}
          </Text>
          <Text style={styles.subtitle}>{T.subtitle}</Text>
        </View>

        <FoundationsPanel />
        <PrimitivesPanel />
        <PatternsPanel />
        <UniversePanel />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg },
  content: { paddingHorizontal: tokens.spacing[4], gap: tokens.spacing[6] },
  header: { gap: tokens.spacing[2] },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  subtitle: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 24 },
})

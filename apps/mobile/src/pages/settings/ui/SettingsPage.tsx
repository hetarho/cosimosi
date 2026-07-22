import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { AccountSection } from '../../../features/account-settings/index.ts'
import { PaletteSection } from '../../../features/change-palette/index.ts'
import { StagingSection } from '../../../features/customize-staging/index.ts'
// The settings page ([52]) composes the same three features as web (계정 · 팔레트 · 연출) through
// their public APIs only. The authenticated app route guards it and supplies the back callback.
export function SettingsPage({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{m.settings_title()}</Text>
        <Button color="neutral" size="sm" onPress={onBack}>
          {m.settings_back()}
        </Button>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{m.settings_section_account()}</Text>
        <AccountSection />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{m.settings_section_palette()}</Text>
        <PaletteSection />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{m.settings_section_staging()}</Text>
        <StagingSection />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg, flex: 1 },
  content: { gap: 32, padding: 24, paddingTop: 48 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: { color: tokens.color.text, fontSize: 18, fontWeight: '500' },
  section: { gap: 12 },
  sectionTitle: { color: tokens.color['text-muted'], fontSize: 14, fontWeight: '500' },
})

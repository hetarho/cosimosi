import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { AccountSection } from '../../../features/account-settings/index.ts'
import { PaletteSection } from '../../../features/change-palette/index.ts'
import { StagingSection } from '../../../features/customize-staging/index.ts'
import { ROUTES, type RootStackScreenProps } from '../routes.ts'

// The settings screen ([52]): mobile screens are the pages layer (no pages/ dir on native), so
// this is the sectioned composition itself — the same three features as the web page (계정 · 팔레트
// · 연출), through their public APIs only; no session state, no palette state, no backend. It
// mounts inside the authenticated stack, so the auth gate ([53]) already guards it — no redirect here.
// The back affordance is the app-layer navigation seam (the features never reach the nav library).
export function SettingsScreen({ navigation }: RootStackScreenProps<'Settings'>) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{m.settings_title()}</Text>
        <Button color="neutral" size="sm" onPress={() => navigation.navigate(ROUTES.universe)}>
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

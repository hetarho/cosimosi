import { useState, type ComponentType } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Tabs, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { AccountProfile } from '../../../features/account-profile/index.ts'
import { AccountSection } from '../../../features/account-settings/index.ts'
import { ExportDiaries } from '../../../features/export-diaries/index.ts'
import { InviteLink } from '../../../features/invite-link/index.ts'
import { WithdrawAccount } from '../../../features/withdraw-account/index.ts'
import { useScreenInsets } from '../../../shared/native/index.ts'

const meTabs = ['profile', 'stardust', 'achievements', 'diary', 'account'] as const
type MeTabId = (typeof meTabs)[number]

const tabViews: Readonly<Record<MeTabId, { title: () => string; Body: ComponentType }>> = {
  profile: { title: m.me_tab_profile, Body: ProfileTab },
  stardust: { title: m.me_tab_stardust, Body: StardustPending },
  achievements: { title: m.me_tab_achievements, Body: AchievementsPending },
  diary: { title: m.me_tab_diary, Body: ExportDiaries },
  account: { title: m.me_tab_account, Body: AccountTab },
}

export function MePage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<MeTabId>('profile')
  const { Body } = tabViews[activeTab]
  const insets = useScreenInsets()

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        // The header clears the device chrome by the live inset; the guessed constant it replaced put
        // the title under the status bar on any device with a taller one.
        {
          paddingTop: insets.top + tokens.spacing[4],
          paddingBottom: insets.bottom + tokens.spacing[8],
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{m.me_title()}</Text>
        <Button color="neutral" size="sm" onPress={onBack}>
          {m.me_back()}
        </Button>
      </View>
      <Tabs
        ariaLabel={m.me_tabs_label()}
        value={activeTab}
        onValueChange={(value) => {
          if (isMeTab(value)) setActiveTab(value)
        }}
        items={meTabs.map((id) => ({
          value: id,
          label: tabViews[id].title(),
          panelId: `me-${id}-panel`,
        }))}
      />
      <View style={styles.section}>
        <Body />
      </View>
    </ScrollView>
  )
}

function isMeTab(value: string): value is MeTabId {
  return (meTabs as readonly string[]).includes(value)
}

function StardustPending() {
  return <Text style={styles.sectionTitle}>{m.me_stardust_pending()}</Text>
}

function AchievementsPending() {
  return <Text style={styles.sectionTitle}>{m.me_achievements_pending()}</Text>
}

function ProfileTab() {
  return (
    <View style={styles.accountTab}>
      <AccountProfile />
      <InviteLink />
    </View>
  )
}

function AccountTab() {
  return (
    <View style={styles.accountTab}>
      <AccountSection />
      <WithdrawAccount exportOffer={<ExportDiaries />} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg, flex: 1 },
  content: { gap: tokens.spacing[8], paddingHorizontal: tokens.spacing[6] },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: { color: tokens.color.text, fontSize: 18, fontWeight: '500' },
  section: { gap: 12 },
  accountTab: { gap: 24 },
  sectionTitle: { color: tokens.color['text-muted'], fontSize: 14, fontWeight: '500' },
})

import { useEffect, useState, type ComponentType } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Tabs, tokens } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'

import { AchievementList } from '../../../features/achievement-list/index.ts'
import { AccountProfile } from '../../../features/account-profile/index.ts'
import { AccountSection } from '../../../features/account-settings/index.ts'
import { MoodColorsTab } from '../../../features/change-mood-colors/index.ts'
import { ExportDiaries } from '../../../features/export-diaries/index.ts'
import { InviteLink } from '../../../features/invite-link/index.ts'
import { ReplayOnboarding } from '../../../features/replay-onboarding/index.ts'
import { TwinkleLedgerTab } from '../../../features/twinkle-ledger/index.ts'
import { WithdrawAccount } from '../../../features/withdraw-account/index.ts'
import { useScreenInsets } from '../../../shared/native/index.ts'

const meTabs = ['profile', 'mood-colors', 'stardust', 'achievements', 'diary', 'account'] as const
export type MeTabId = (typeof meTabs)[number]

// Every tab body is handed the screen's back callback, and the profile tab's last row is the one that
// uses it: replaying the onboarding tour means leaving /me for the universe the tour narrates. The page
// still names no route — the callback is the navigation layer's.
interface MeTabBodyProps {
  onExit: () => void
}

const tabViews: Readonly<
  Record<MeTabId, { title: () => string; Body: ComponentType<MeTabBodyProps> }>
> = {
  profile: { title: m.me_tab_profile, Body: ProfileTab },
  'mood-colors': { title: m.me_tab_mood_colors, Body: MoodColorsTab },
  stardust: { title: m.me_tab_stardust, Body: TwinkleLedgerTab },
  achievements: { title: m.me_tab_achievements, Body: AchievementList },
  diary: { title: m.me_tab_diary, Body: ExportDiaries },
  account: { title: m.me_tab_account, Body: AccountTab },
}

export function MePage({
  onBack,
  initialTab,
}: {
  onBack: () => void
  // A deep link can carry anything, so the param is validated here rather than trusted into a lookup.
  initialTab?: string
}) {
  const requestedTab = initialTab !== undefined && isMeTab(initialTab) ? initialTab : undefined
  const [activeTab, setActiveTab] = useState<MeTabId>(requestedTab ?? 'profile')
  // Follow a NEW request, not just the first one: navigating to an already-stacked /me with a tab (the
  // earn guide pointing at achievements) merges params onto the mounted screen, so an initializer alone
  // would land the reader on whatever tab they last chose.
  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab)
  }, [requestedTab])
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
        <Body onExit={onBack} />
      </View>
    </ScrollView>
  )
}

function isMeTab(value: string): value is MeTabId {
  return (meTabs as readonly string[]).includes(value)
}

function ProfileTab({ onExit }: MeTabBodyProps) {
  return (
    <View style={styles.accountTab}>
      <AccountProfile />
      <InviteLink />
      <ReplayOnboarding onExit={onExit} />
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
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  section: { gap: 12 },
  accountTab: { gap: 24 },
})

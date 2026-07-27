import type { ComponentType } from 'react'

import { Button, Tabs } from '@cosimosi/ui'

import { AccountProfile } from '../../../features/account-profile/index.ts'
import { AccountSection } from '../../../features/account-settings/index.ts'
import { ExportDiaries } from '../../../features/export-diaries/index.ts'
import { InviteLink } from '../../../features/invite-link/index.ts'
import { TwinkleLedgerTab } from '../../../features/twinkle-ledger/index.ts'
import { WithdrawAccount } from '../../../features/withdraw-account/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { ME_TABS, type MeTabId } from '../model/tabs.ts'

const TAB_VIEWS: Readonly<Record<MeTabId, { title: () => string; Body: ComponentType }>> = {
  profile: { title: m.me_tab_profile, Body: ProfileTab },
  stardust: { title: m.me_tab_stardust, Body: TwinkleLedgerTab },
  achievements: { title: m.me_tab_achievements, Body: AchievementsPending },
  diary: { title: m.me_tab_diary, Body: ExportDiaries },
  account: { title: m.me_tab_account, Body: AccountTab },
}

export interface MePageProps {
  activeTab: MeTabId
  onTabChange: (tab: MeTabId) => void
  onExit: () => void
}

export function MePage({ activeTab, onTabChange, onExit }: MePageProps) {
  const { Body } = TAB_VIEWS[activeTab]
  const panelId = `me-${activeTab}-panel`

  return (
    <main className="min-h-dvh bg-background text-text">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-medium">{m.me_title()}</h1>
          <Button color="neutral" size="sm" onClick={onExit}>
            {m.me_back()}
          </Button>
        </header>
        <Tabs
          ariaLabel={m.me_tabs_label()}
          value={activeTab}
          onValueChange={(value) => onTabChange(value as MeTabId)}
          items={ME_TABS.map((id) => ({
            value: id,
            label: TAB_VIEWS[id].title(),
            panelId: `me-${id}-panel`,
          }))}
        />
        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab`}
          className="flex flex-col gap-4"
        >
          <Body />
        </section>
      </div>
    </main>
  )
}

function AchievementsPending() {
  return <p className="text-sm text-text-muted">{m.me_achievements_pending()}</p>
}

function ProfileTab() {
  return (
    <div className="flex flex-col gap-4">
      <AccountProfile />
      <InviteLink />
    </div>
  )
}

function AccountTab() {
  return (
    <div className="flex flex-col gap-6">
      <AccountSection />
      <WithdrawAccount exportOffer={<ExportDiaries />} />
    </div>
  )
}

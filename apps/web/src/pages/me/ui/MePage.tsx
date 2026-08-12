import type { ComponentType } from 'react'

import { Button, Tabs } from '@cosimosi/ui'

import { AchievementList } from '../../../features/achievement-list/index.ts'
import { AccountProfile } from '../../../features/account-profile/index.ts'
import { AccountSection } from '../../../features/account-settings/index.ts'
import { MoodColorsTab } from '../../../features/change-mood-colors/index.ts'
import { ExportDiaries } from '../../../features/export-diaries/index.ts'
import { InviteLink } from '../../../features/invite-link/index.ts'
import { ReplayOnboarding } from '../../../features/replay-onboarding/index.ts'
import { TwinkleLedgerTab } from '../../../features/twinkle-ledger/index.ts'
import { WithdrawAccount } from '../../../features/withdraw-account/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { ME_TABS, type MeTabId } from '../model/tabs.ts'

// Every tab body is handed the page's exit callback, and the profile tab's rows are the ones that
// use it: replaying the onboarding tour means leaving /me for the universe the tour narrates. The
// page still imports no router — the callback is the app layer's.
interface MeTabBodyProps {
  onExit: () => void
}

const TAB_VIEWS: Readonly<
  Record<MeTabId, { title: () => string; Body: ComponentType<MeTabBodyProps> }>
> = {
  profile: { title: m.me_tab_profile, Body: ProfileTab },
  'mood-colors': { title: m.me_tab_mood_colors, Body: MoodColorsTab },
  stardust: { title: m.me_tab_stardust, Body: TwinkleLedgerTab },
  achievements: { title: m.me_tab_achievements, Body: AchievementList },
  diary: { title: m.me_tab_diary, Body: ExportDiaries },
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
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        {/* The way out on the LEFT, and the title CENTRED and naming the open tab rather than the
            account home in general: with the tab strip right beneath it, a fixed 나 said nothing the
            strip did not already say, while the open tab's own name is the one fact the header can add
            about where the reader is. A three-cell grid rather than `justify-between`, so the title is
            centred on the HEADER and does not drift with the width of the control beside it — and an
            empty third cell, because nothing belongs opposite the way out. */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="justify-self-start">
            <Button color="neutral" size="sm" onClick={onExit}>
              {m.me_back()}
            </Button>
          </div>
          <h1 className="text-center text-lg font-medium">{TAB_VIEWS[activeTab].title()}</h1>
          <div aria-hidden />
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
          <Body onExit={onExit} />
        </section>
      </div>
    </main>
  )
}

// The profile tab holds everything that is true of the person rather than of their universe: who they
// are here, the invitation they can hand out, the tour they can watch again — and then, at the foot,
// the account itself. The account rows sit LAST and behind a separating rule: signing out and leaving
// are the two things on this page a stray press must not reach, so distance is what protects them
// ([U9]). Withdrawal keeps its own confirmation and its export offer regardless.
function ProfileTab({ onExit }: MeTabBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <AccountProfile />
      <InviteLink />
      <ReplayOnboarding onExit={onExit} />
      <div className="mt-2 flex flex-col gap-6 border-t border-border pt-6">
        <AccountSection />
        <WithdrawAccount exportOffer={<ExportDiaries />} />
      </div>
    </div>
  )
}

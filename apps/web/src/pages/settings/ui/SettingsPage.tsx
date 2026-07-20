import type { ComponentType } from 'react'

import { Button } from '@cosimosi/ui'

import { AccountSection } from '../../../features/account-settings/index.ts'
import { PaletteSection } from '../../../features/change-palette/index.ts'
import { StagingSection } from '../../../features/customize-staging/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../model/sections.ts'

const SECTION_VIEWS: Readonly<
  Record<SettingsSectionId, { title: () => string; Body: ComponentType }>
> = {
  account: { title: m.settings_section_account, Body: AccountSection },
  palette: { title: m.settings_section_palette, Body: PaletteSection },
  staging: { title: m.settings_section_staging, Body: StagingSection },
}

// The one settings surface ([52]): a sectioned composition of the three features through their
// public APIs — it owns no session state, no palette state, no backend, and reaches the running
// universe only through what the hosted features already own. `/settings` mounts under the [53]
// auth gate; this page implements no redirect of its own. `onExit` is the app-layer navigation
// seam back to the universe (the page never reaches the router).
export function SettingsPage({ onExit }: { onExit: () => void }) {
  return (
    <main className="min-h-dvh bg-background text-text">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 p-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-medium">{m.settings_title()}</h1>
          <Button color="neutral" size="sm" onClick={onExit}>
            {m.settings_back()}
          </Button>
        </header>
        {SETTINGS_SECTIONS.map((id) => {
          const { title, Body } = SECTION_VIEWS[id]
          return (
            <section key={id} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-text-muted">{title()}</h2>
              <Body />
            </section>
          )
        })}
      </div>
    </main>
  )
}

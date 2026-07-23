import { useEffect, useState, type ReactNode } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetAdminSelfQueryOptions } from '@cosimosi/api-client'
import { Button, Card } from '@cosimosi/ui'

import { ModelSelectSection, ProviderKeysSection } from '../../../features/admin-ai-config/index.ts'
import { JobsSection } from '../../../features/admin-jobs/index.ts'
import { UsageSection } from '../../../features/admin-usage/index.ts'
import { UsersSection } from '../../../features/admin-users/index.ts'
import { m } from '../../../shared/i18n/index.ts'

type TabId = 'users' | 'keys' | 'models' | 'usage' | 'jobs'

// The admin console page: a web-only operator surface. One page, tabbed — users, provider keys, AI
// models, usage, and job health. It gates on GetAdminSelf as the UX mirror of the backend
// admin-authorization interceptor (the BE is authoritative — every admin.v1 call is rejected for a
// non-admin regardless). A settled non-admin is sent back to the universe (onExit); loading holds.
// Navigation arrives as a prop from the app-layer route component, so the page imports no router.
export function AdminPage({ onExit }: { onExit: () => void }) {
  const transport = useTransport()
  const selfQuery = useQuery(createGetAdminSelfQueryOptions(transport))
  const isAdmin = selfQuery.data?.isAdmin ?? false
  const [tab, setTab] = useState<TabId>('users')

  useEffect(() => {
    if (selfQuery.isSuccess && !isAdmin) {
      onExit()
    }
  }, [selfQuery.isSuccess, isAdmin, onExit])

  if (selfQuery.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
        <p className="text-sm">{m.admin_loading()}</p>
      </main>
    )
  }
  if (!isAdmin) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
        <p className="text-sm">{m.admin_not_admin()}</p>
      </main>
    )
  }

  const tabs: Array<{ id: TabId; label: string; content: ReactNode }> = [
    { id: 'users', label: m.admin_section_users(), content: <UsersSection /> },
    { id: 'keys', label: m.admin_section_provider_keys(), content: <ProviderKeysSection /> },
    { id: 'models', label: m.admin_section_ai_models(), content: <ModelSelectSection /> },
    { id: 'usage', label: m.admin_section_usage(), content: <UsageSection /> },
    { id: 'jobs', label: m.admin_section_jobs(), content: <JobsSection /> },
  ]
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 bg-background px-4 py-8 text-text">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{m.admin_title()}</h1>
        <Button variant="outlined" color="neutral" size="sm" onClick={onExit}>
          {m.admin_back()}
        </Button>
      </header>

      <div role="tablist" aria-label={m.admin_title()} className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            variant={t.id === tab ? 'contained' : 'text'}
            color={t.id === tab ? 'primary' : 'neutral'}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card variant="solid">
        <div className="p-5">{active.content}</div>
      </Card>
    </main>
  )
}

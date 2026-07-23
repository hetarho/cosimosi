import { useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetAdminSelfQueryOptions } from '@cosimosi/api-client'
import { Button } from '@cosimosi/ui'

import { AiConfigSection } from '../../../features/admin-ai-config/index.ts'
import { JobsSection } from '../../../features/admin-jobs/index.ts'
import { UsageSection } from '../../../features/admin-usage/index.ts'
import { UsersSection } from '../../../features/admin-users/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// The admin console page (the admin console): a web-only operator surface composing the four admin features.
// It gates on GetAdminSelf as the UX mirror of the backend admin-authorization interceptor (the BE
// is authoritative — every admin.v1 call is rejected for a non-admin regardless of this gate). A
// settled non-admin is sent back to the universe (onExit); a loading state holds. Navigation
// arrives as a prop from the app-layer route component, so the page imports no router (§3.1).
export function AdminPage({ onExit }: { onExit: () => void }) {
  const transport = useTransport()
  const selfQuery = useQuery(createGetAdminSelfQueryOptions(transport))
  const isAdmin = selfQuery.data?.isAdmin ?? false

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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 bg-background px-4 py-8 text-text">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-medium">{m.admin_title()}</h1>
        <Button color="neutral" size="sm" onClick={onExit}>
          {m.admin_back()}
        </Button>
      </header>
      <Section title={m.admin_section_ai()}>
        <AiConfigSection />
      </Section>
      <Section title={m.admin_section_users()}>
        <UsersSection />
      </Section>
      <Section title={m.admin_section_usage()}>
        <UsageSection />
      </Section>
      <Section title={m.admin_section_jobs()}>
        <JobsSection />
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-muted">{title}</h2>
      {children}
    </section>
  )
}

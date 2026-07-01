import { useNavigate } from '@tanstack/react-router'

import { m } from '@cosimosi/i18n'
import { Button } from '@cosimosi/ui'

/** Rendered for any unmatched path, and for /test when the diagnostics flag is off. */
export function NotFoundScreen() {
  const navigate = useNavigate()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-text">
      <h1 className="text-2xl font-medium">{m.not_found_title()}</h1>
      <p className="text-text-muted">{m.not_found_description()}</p>
      <Button onClick={() => navigate({ to: '/' })}>{m.not_found_home_action()}</Button>
    </main>
  )
}

import { useNavigate } from '@tanstack/react-router'

import { m } from '../../shared/i18n/index.ts'
import { Button } from '@cosimosi/ui'

/** Rendered for any unmatched path, and for /test when the diagnostics flag is off. */
export function NotFoundScreen() {
  const navigate = useNavigate()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-text">
      <h1 className="text-2xl font-medium">{m.not_found_title()}</h1>
      <p className="text-text-muted">{m.not_found_description()}</p>
      {/* `/` rather than `/universe`: the root is the app's one decision point, so this lands a visitor on
          the front door and a signed-in user in their universe without the screen having to know which. */}
      <Button onClick={() => navigate({ to: '/' })}>{m.not_found_home_action()}</Button>
    </main>
  )
}

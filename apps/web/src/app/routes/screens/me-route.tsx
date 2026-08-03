import { useSearch } from '@tanstack/react-router'

import { MePage } from '../../../pages/me/index.ts'
import { parseMeTab, type MeSearchParams } from '../me-search.ts'
import { useAppNavigate } from '../navigation.ts'

// Reached through a dynamic import from `route-tree.tsx` — see `universe-route.tsx` for why each
// signed-in screen owns its own module.
export function MeRoute() {
  const navigate = useAppNavigate()
  const search = useSearch({ strict: false }) as MeSearchParams
  return (
    <MePage
      activeTab={parseMeTab(search.tab)}
      onTabChange={(tab) => navigate({ to: '/me', search: { tab }, replace: true })}
      onExit={() => navigate({ to: '/universe' })}
    />
  )
}

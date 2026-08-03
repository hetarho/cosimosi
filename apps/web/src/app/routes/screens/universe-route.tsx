import { UniverseHomePage } from '../../../pages/universe/index.ts'
import { useAppNavigate } from '../navigation.ts'

// The router seam stays confined to this segment: the universe/reader surfaces navigate between
// each other through callbacks these app-layer route components supply, so no page or widget
// imports the router. Named components (not inline arrows) so the navigation hook obeys the
// rules-of-hooks. The universe lives at '/universe'; the archive is its own ('/diary').
//
// In its own module rather than beside the public screens because `route-tree.tsx` reaches it
// through a dynamic import: a chunk boundary is drawn per module, so a signed-in surface sharing a
// file with the landing page would ship to every stranger who opens the front door.
export function UniverseRoute() {
  const navigate = useAppNavigate()
  return (
    <UniverseHomePage
      onOpenReader={() => navigate({ to: '/diary' })}
      onOpenMe={() => navigate({ to: '/me', search: { tab: 'profile' } })}
      // Where earning is actually claimed ([A4]) — the app layer owns the tab id because it owns the
      // route; the page and the widget below it know only the intent.
      onOpenAchievements={() => navigate({ to: '/me', search: { tab: 'achievements' } })}
    />
  )
}

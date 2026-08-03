import { AdminPage } from '../../../pages/admin/index.ts'
import { useAppNavigate } from '../navigation.ts'

// The admin console route (web-only, the admin console). It mounts under the authenticated subtree; the page
// itself gates on GetAdminSelf and sends a non-admin back to the universe (the BE interceptor is
// the authoritative gate — a non-admin's admin.v1 calls are rejected regardless).
//
// Reached through a dynamic import from `route-tree.tsx` — see `universe-route.tsx` for why each
// non-public screen owns its own module.
export function AdminRoute() {
  const navigate = useAppNavigate()
  return <AdminPage onExit={() => navigate({ to: '/universe' })} />
}

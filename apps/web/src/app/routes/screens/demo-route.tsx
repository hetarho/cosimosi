import { DemoPage } from '../../../pages/demo/index.ts'
import { useAppNavigate } from '../navigation.ts'

// The public demo route. The only thing the page needs from the router is where the closing CTA
// goes, so it takes a callback and imports no router — the same seam as UniverseRoute/LoginRoute.
// There is no session check here on purpose: the demo is for people who do not have one.
//
// Public but still dynamically imported: nobody lands on /demo cold — it is reached from the landing
// page's CTA, so the sandbox and its three fixture sets can be fetched on that click instead of
// riding in the chunk the front door already blocks on.
export function DemoRoute() {
  const navigate = useAppNavigate()
  return <DemoPage onSignUp={() => navigate({ to: '/signup' })} />
}

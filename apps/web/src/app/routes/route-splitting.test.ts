import { describe, expect, it } from 'vitest'

// `?raw` rather than `node:fs`: this app is typed for the browser, and the source reads through the
// same bundler that would do the leaking.
import meSearchSource from './me-search.ts?raw'
import { createAppRouter } from './router.ts'

// The bundle split is invisible from inside the app — nothing renders differently, and the only
// signal a build gives is an advisory size line. So the boundary is pinned here instead: a screen
// converted back to a static import, or a public page quietly made lazy, fails this rather than
// silently costing every cold visitor the 1.7 MB this split took off the front door.
//
// `lazyRouteComponent` marks its result with a `.preload` function; a plain component has none.
const isLazy = (component: unknown) =>
  typeof component === 'function' &&
  typeof (component as { preload?: unknown }).preload === 'function'

const router = () =>
  createAppRouter({ diagnosticsEnabled: true, getSessionStatus: () => 'signedOut' })

describe('route-level code splitting', () => {
  it.each([
    '/authenticated/universe',
    '/authenticated/diary',
    '/authenticated/me',
    '/authenticated/admin',
    '/demo',
    '/test',
    '/design',
  ])('fetches %s on demand', (id) => {
    const route = router().routesById[id as '/demo']
    expect(isLazy(route.options.component)).toBe(true)
  })

  // The public entry surface stays static: lazy-loading the very page the visitor asked for would add
  // a round trip to the path the split exists to speed up.
  it.each(['/', '/login', '/signup', '/invite/$token', '/blog/$'])(
    'ships %s in the entry chunk',
    (id) => {
      const route = router().routesById[id as '/login']
      expect(isLazy(route.options.component)).toBe(false)
    },
  )

  // The guard must keep running before any product route mounts, so the layout route that carries it
  // cannot move behind a dynamic import — an unauthenticated frame rendering first is a correctness
  // regression, not a perf trade.
  it('keeps the authenticated layout and its guard static', () => {
    const route = router().routesById['/authenticated']
    expect(isLazy(route.options.component)).toBe(false)
    expect(typeof route.options.beforeLoad).toBe('function')
  })

  // Without this the router wraps no match in Suspense, so a lazily-imported screen suspends to the
  // root's null fallback — a blank frame instead of a hold.
  it('gives every loading route the same deliberate pending state', () => {
    expect(router().options.defaultPendingComponent).toBeTypeOf('function')
  })

  // The lazy boundary above is only half the guarantee: `me-search.ts` is in the entry chunk because
  // `validateSearch` runs before any fetch, so a VALUE import from `pages/me` there would quietly drag
  // `MePage` and its nine features back in while every assertion above still passed. Only the erased
  // `import type` is allowed. Read as source because the leak is a property of the import statement,
  // not of anything observable at runtime.
  it('keeps the entry-chunk search parsers free of value imports from pages', () => {
    const pageImports = meSearchSource.match(/^import\s.*from\s+'[^']*\/pages\/[^']*'/gm) ?? []
    expect(pageImports.length).toBeGreaterThan(0)
    for (const statement of pageImports) expect(statement).toMatch(/^import type\s/)
  })
})

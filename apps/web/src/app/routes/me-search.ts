// `/me`'s address bar, the same seam `diary-search.ts` is for `/diary`: the app layer is the only
// place the URL's `?tab=` vocabulary and the screen's shape meet, so `pages/me` holds no mirror of it.
//
// The type comes from the page and the runtime list lives here on purpose. `validateSearch` runs
// before any chunk is fetched, so the accepted ids have to be in the entry chunk — and a value
// import from `pages/me` would drag `MePage` in with them and undo the route's lazy boundary. A
// `import type` is erased, so the union still constrains this list without costing a byte.
import type { MeTabId } from '../../pages/me/index.ts'

export interface MeSearchParams {
  tab?: MeTabId
}

// `satisfies Record<MeTabId, true>` is what keeps this from becoming a second source of truth: adding
// a tab to the page's union without listing it here fails `pnpm typecheck`.
const ME_TAB_IDS = {
  profile: true,
  'mood-colors': true,
  stardust: true,
  achievements: true,
  diary: true,
  account: true,
} as const satisfies Record<MeTabId, true>

/** The tab a `?tab=` value asks for, or the default when it asks for nothing usable. */
export function parseMeTab(value: unknown): MeTabId {
  // `Object.hasOwn`, not `in`: the URL is user-editable, and `in` walks the prototype chain — it would
  // accept `?tab=toString` as a tab id and hand the page a key it has no panel for.
  return typeof value === 'string' && Object.hasOwn(ME_TAB_IDS, value)
    ? (value as MeTabId)
    : 'profile'
}

// Validate-or-drop, like the archive's conditions: a hand-typed `?tab=nonsense` lands on the default
// tab rather than reaching the screen as a key it has no panel for. Note this drops the key from the
// route match's search, NOT from the address bar — on a cold load the raw query string stays visible
// until the next navigation replaces it.
export function parseMeSearch(search: Record<string, unknown>): MeSearchParams {
  const tab = parseMeTab(search.tab)
  return { tab: search.tab === tab ? tab : undefined }
}

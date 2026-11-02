// `/me`'s address bar, the same seam `diary-search.ts` is for `/diary`: the app layer is the only
// place the URL's `?tab=` vocabulary and the screen's shape meet, so `pages/me` holds no mirror of it.
//
// The tab list comes from `@cosimosi/account`, which the entry chunk already carries for the auth
// providers. `validateSearch` runs before any chunk is fetched, so the accepted ids have to be in the
// entry chunk — and a value import from `pages/me` would drag `MePage` in with them and undo the
// route's lazy boundary.
import { ME_TABS, type MeTabId } from '@cosimosi/account'

export interface MeSearchParams {
  tab?: MeTabId
}

/** The tab a `?tab=` value asks for, or the default when it asks for nothing usable. */
export function parseMeTab(value: unknown): MeTabId {
  // A membership test over the list, not `in` over an object: the URL is user-editable, and `in` walks
  // the prototype chain — it would accept `?tab=toString` as a tab id.
  return typeof value === 'string' && (ME_TABS as readonly string[]).includes(value)
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

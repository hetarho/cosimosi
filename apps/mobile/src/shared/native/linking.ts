import { Linking } from 'react-native'

/**
 * Inbound-link seam (ARCH-28). The app root owns link parsing only to
 * the extent the shell needs (auth callbacks, future typed routes); product deep
 * links are later feature work. The navigation layer turns
 * these prefixes into React Navigation's typed linking config, which owns the
 * native `Linking` integration for screen links — the auth-callback subscription
 * below is the one shell-level exception, so feature/domain slices never touch links.
 */
export const mobileLinkingPrefixes = ['cosimosi://'] as const

/**
 * Where the Google consent browser returns the user. Must be registered natively
 * (iOS `CFBundleURLTypes`, Android VIEW/BROWSABLE intent-filter) and listed in the
 * Supabase redirect allowlist (DEPLOY.md §5) — it is a callback address, not a screen,
 * so the navigation linking config filters it out.
 */
export const mobileAuthCallbackUrl = 'cosimosi://auth-callback'
const mobileInvitePrefix = 'cosimosi://invite/'

// Exact-address match: the callback host must END at the registered address (only a
// query/fragment/path may follow), so a look-alike host such as
// `cosimosi://auth-callback.evil` never reaches the OAuth completion path.
export function isAuthCallbackUrl(url: string): boolean {
  if (!url.startsWith(mobileAuthCallbackUrl)) return false
  const rest = url.slice(mobileAuthCallbackUrl.length)
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') || rest.startsWith('/')
}

export function inviteTokenFromUrl(url: string): string | null {
  if (!url.startsWith(mobileInvitePrefix)) return null
  const encodedToken = url.slice(mobileInvitePrefix.length)
  if (!encodedToken || /[/?#]/.test(encodedToken)) return null
  try {
    const token = decodeURIComponent(encodedToken).trim()
    return token && !/[/?#]/.test(token) ? token : null
  } catch {
    return null
  }
}

export function isInviteUrl(url: string): boolean {
  return inviteTokenFromUrl(url) !== null
}

/** Open a URL outside the app (the system browser for OAuth consent). */
export function openExternalUrl(url: string): Promise<void> {
  return Linking.openURL(url)
}

// A URL reaches at most one delivery per process. `getInitialURL` and the `url` event can BOTH
// report the cold-start link, and a remounted provider subscribes again; a second exchange of the
// same single-use OAuth code would race and fail the sign-in.
const deliveredUrls = new Set<string>()

/**
 * Deliver each matching URL — including the one that cold-started the app — to `onValue`, never
 * after the subscription is removed (a late `getInitialURL` would otherwise reach a released
 * owner).
 */
function subscribeToUrls<T>(
  select: (url: string) => T | null,
  onValue: (value: T) => void,
): () => void {
  let active = true
  const deliver = (url: string | null) => {
    if (!active || !url || deliveredUrls.has(url)) return
    const value = select(url)
    if (value === null) return
    deliveredUrls.add(url)
    onValue(value)
  }
  Linking.getInitialURL()
    .then(deliver)
    .catch(() => undefined)
  const subscription = Linking.addEventListener('url', ({ url }) => deliver(url))
  return () => {
    active = false
    subscription.remove()
  }
}

/**
 * Deliver every auth-callback deep link to `onUrl`. Non-callback URLs are ignored here; they
 * belong to the navigation linking config.
 */
export function subscribeToAuthCallbackUrls(onUrl: (url: string) => void): () => void {
  return subscribeToUrls((url) => (isAuthCallbackUrl(url) ? url : null), onUrl)
}

/** Capture invite links at the shell seam; they are auth-entry events, not screens. */
export function subscribeToInviteUrls(onToken: (token: string) => void): () => void {
  return subscribeToUrls(inviteTokenFromUrl, onToken)
}

/** Test seam: forget which URLs this process has delivered. */
export function forgetDeliveredUrlsForTests(): void {
  deliveredUrls.clear()
}

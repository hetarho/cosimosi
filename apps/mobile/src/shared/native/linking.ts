import { Linking } from 'react-native'

/**
 * Inbound-link seam (ARCHITECTURE §3.5). The app root owns link parsing only to
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

// Exact-address match: the callback host must END at the registered address (only a
// query/fragment/path may follow), so a look-alike host such as
// `cosimosi://auth-callback.evil` never reaches the OAuth completion path.
export function isAuthCallbackUrl(url: string): boolean {
  if (!url.startsWith(mobileAuthCallbackUrl)) return false
  const rest = url.slice(mobileAuthCallbackUrl.length)
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') || rest.startsWith('/')
}

/** Open a URL outside the app (the system browser for OAuth consent). */
export function openExternalUrl(url: string): Promise<void> {
  return Linking.openURL(url)
}

/**
 * Deliver every auth-callback deep link — including the one that cold-started the
 * app — to `onUrl`. Non-callback URLs are ignored here; they belong to the
 * navigation linking config. `getInitialURL` and the `url` event can BOTH report
 * the cold-start link, so identical URLs are delivered once — a second exchange of
 * the same single-use OAuth code would race and fail the sign-in.
 */
export function subscribeToAuthCallbackUrls(onUrl: (url: string) => void): () => void {
  let lastDelivered: string | null = null
  const deliver = (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url) || url === lastDelivered) return
    lastDelivered = url
    onUrl(url)
  }
  Linking.getInitialURL()
    .then(deliver)
    .catch(() => undefined)
  const subscription = Linking.addEventListener('url', ({ url }) => deliver(url))
  return () => subscription.remove()
}

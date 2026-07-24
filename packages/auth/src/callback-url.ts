// Hand-rolled query parsing: Hermes (RN) ships URL without a working
// `searchParams`, and this package must stay platform-pure — no `new URL`.
// Shared by the real and fake adapters so their callback semantics cannot drift.
export function callbackUrlParam(url: string, key: string): string | null {
  const query = url.split('#')[0]?.split('?')[1]
  if (!query) return null
  for (const pair of query.split('&')) {
    const [candidate, ...rest] = pair.split('=')
    if (candidate === key) {
      const value = rest.join('=')
      return value ? decodeURIComponent(value.replaceAll('+', ' ')) : ''
    }
  }
  return null
}

// The provider error carried by an OAuth error callback (`error_description` wins over
// the terser `error`), or null for a success callback. GoTrue emits some error classes
// in the hash fragment (`#error=…`) rather than the query — supabase-js itself parses
// both — so the fragment is checked as a query string too.
export function callbackUrlError(url: string): string | null {
  return (
    callbackUrlParam(url, 'error_description') ??
    callbackUrlParam(url, 'error') ??
    fragmentParam(url, 'error_description') ??
    fragmentParam(url, 'error')
  )
}

function fragmentParam(url: string, key: string): string | null {
  const fragment = url.split('#')[1]
  if (!fragment) return null
  return callbackUrlParam(`?${fragment}`, key)
}

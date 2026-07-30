// The one place an absolute or internal URL is built.
//
// Astro's `base` rewrites nothing in an authored href string, so a literal `/rss.xml` in a template keeps
// pointing at the origin root — where the app's SPA answers it. Deriving every internal link from
// `BASE_URL` instead is the only guard that survives a base change, and the absolute form is required by
// canonical links, OG tags, the feed and the sitemap.

/** `/blog/` — always exactly one trailing slash, whatever `base` was configured as. */
export const BASE_PATH = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/`

/** An internal href under the blog's base: `path('rss.xml')` → `/blog/rss.xml`. */
export function path(relative = ''): string {
  return `${BASE_PATH}${relative.replace(/^\/+/, '')}`
}

/** The absolute form of the same, for anything a crawler or a feed reader consumes. */
export function absolute(relative = '', site: URL | undefined): string {
  const origin = (site?.origin ?? 'https://cosimosi.haeram.me').replace(/\/+$/, '')
  return `${origin}${path(relative)}`
}

/** The share image every page falls back to. A raster, because the major crawlers do not render SVG. */
export const OG_IMAGE = 'og-blog.png'

import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  site: process.env.BLOG_SITE_URL ?? 'https://cosimosi.haeram.me',
  // The blog is a SUBPATH of the app's origin, not a subdomain — one domain keeps its authority in one
  // place and every landing↔post link same-origin. `base` is what makes that work: without it every page
  // requests its own `_astro/*.css` from the origin root, where nothing is served.
  base: '/blog',
  // `/blog/<slug>/` is the canonical form, pinned rather than inherited so the sitemap, the canonical link
  // and the Worker's asset handler all agree. The app's own router pins the opposite (`never`) for its
  // routes; the two cannot collide because `/blog/**` is served by the asset handler and never enters it.
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Emitted as a file rather than inlined, which is what makes `base` observable: an `_astro/*.css`
    // request is the thing that 404s at the origin root if the base is ever wrong, so the staged-output
    // assertion has something to assert. It is also the better trade for a ten-page blog — one cacheable
    // stylesheet instead of the same 6 KB duplicated into every page.
    inlineStylesheets: 'never',
  },
})

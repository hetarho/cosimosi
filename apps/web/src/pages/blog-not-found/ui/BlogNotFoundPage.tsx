import { useEffect } from 'react'

import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// pages/blog-not-found: what a miss under `/blog/**` gets.
//
// The blog is static HTML the Worker's asset handler serves, so a real post never reaches this — assets
// resolve first, and the SPA only executes when nothing matched. What does reach it is a stale link or a
// typo, and the app's own not-found screen would answer those in the app's voice, offering the universe to
// someone who came to read an essay. This is the same repair in the right register.
//
// Web-only on purpose, and not for want of parity: it repairs a URL, and a native app has none.
export function BlogNotFoundPage({ onBackToBlog }: { onBackToBlog: () => void }) {
  // `not_found_handling: "single-page-application"` answers a miss with HTTP **200**, so a crawler that
  // reaches this sees a page rather than a 404. A true status code would need a Worker script in front of
  // the assets, which the one-Worker arrangement rules out — so `noindex` plus a sitemap that lists only
  // real posts are the mitigations. Set imperatively because this app has no per-route head seam.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-text">
      <h1 className="text-2xl font-medium">{m.blog_not_found_title()}</h1>
      <p className="max-w-md text-text-muted">{m.blog_not_found_description()}</p>
      <Button color="neutral" onClick={onBackToBlog}>
        {m.blog_not_found_action()}
      </Button>
    </main>
  )
}

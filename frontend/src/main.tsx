import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { App } from '@/app'
import '@/app/styles/index.css'

// Production error tracking (spec 14 §9). DSN is build-time (VITE_SENTRY_DSN, set per
// environment in Cloudflare Pages). No DSN → init skipped, so local/dev builds and the
// keyless flow are unaffected.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

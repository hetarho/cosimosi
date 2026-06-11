import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initAnalytics } from '@/shared/lib'
import { App } from '@/app'
import '@/app/styles/index.css'

// Production error tracking (spec 14 §9, 강화는 18). DSN is build-time (VITE_SENTRY_DSN,
// set per environment in the CF Workers build). No DSN → init skipped, so local/dev
// builds and the keyless flow are unaffected.
//
// release = VITE_APP_VERSION (vite.config가 WORKERS_CI_COMMIT_SHA에서 주입) — Sentry
// 이벤트를 "어떤 배포에서 깨졌나"로 묶는 키(3.4). 트레이싱은 낮은 샘플레이트(0.1)로
// 페이지 로드/네비게이션 성능만 본다. tracePropagationTargets는 기본값(동일 출처)을
// 유지한다 — 교차 출처 API(api.<도메인>)에 sentry-trace 헤더를 붙이면 백엔드 CORS
// allow-headers에 없어서 프리플라이트가 깨진다.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}

// 제품 지표 (spec 18). 키 없으면 전부 no-op — 로컬/체험 모드 무영향(3.1).
initAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY,
  host: import.meta.env.VITE_POSTHOG_HOST,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

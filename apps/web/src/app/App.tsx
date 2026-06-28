import { m, useActiveLocale } from '../shared/i18n/index.ts'
import { WebAuthProvider } from './auth-provider.tsx'
import { WebI18nProvider } from './i18n-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

export default function App() {
  return (
    <WebI18nProvider>
      <WebAuthProvider>
        <WebClientCacheProvider>
          <Greeting />
        </WebClientCacheProvider>
      </WebAuthProvider>
    </WebI18nProvider>
  )
}

function Greeting() {
  useActiveLocale() // re-render this copy when the locale changes
  return <h1>{m.app_greeting()}</h1>
}

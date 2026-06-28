import { WebAuthProvider } from './auth-provider.tsx'
import { WebI18nProvider } from './i18n-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'
import { UiShowcase } from './ui-showcase.stories.tsx'

export default function App() {
  return (
    <WebI18nProvider>
      <WebAuthProvider>
        <WebClientCacheProvider>
          <UiShowcase />
        </WebClientCacheProvider>
      </WebAuthProvider>
    </WebI18nProvider>
  )
}

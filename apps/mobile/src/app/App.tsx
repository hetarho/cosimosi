import { MobileAuthProvider } from './auth-provider';
import { MobileI18nProvider } from './i18n-provider';
import { MobileClientCacheProvider } from './query-provider';
import { UiShowcase } from './ui-showcase.stories.tsx';

export default function App() {
  return (
    <MobileI18nProvider>
      <MobileAuthProvider>
        <MobileClientCacheProvider>
          <UiShowcase />
        </MobileClientCacheProvider>
      </MobileAuthProvider>
    </MobileI18nProvider>
  );
}

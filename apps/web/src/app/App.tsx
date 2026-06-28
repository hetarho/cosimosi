import { WebAuthProvider } from './auth-provider.tsx'
import { WebClientCacheProvider } from './query-provider.tsx'

export default function App() {
  return (
    <WebAuthProvider>
      <WebClientCacheProvider>
        <h1>hello world</h1>
      </WebClientCacheProvider>
    </WebAuthProvider>
  )
}

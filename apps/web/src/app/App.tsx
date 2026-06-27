import { WebAuthProvider } from './auth-provider.tsx'

export default function App() {
  return (
    <WebAuthProvider>
      <h1>hello world</h1>
    </WebAuthProvider>
  )
}

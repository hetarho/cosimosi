// Connect transport + MemoryService client.
//
// In dev, baseUrl '/api' is rewritten to the backend root by the Vite proxy
// (vite.config.ts), so calls hit '/cosimosi.v1.MemoryService/…' with no CORS.
// Built assets (preview/prod) have no such proxy, so they target the backend
// origin from VITE_API_URL. The auth interceptor reads the current Supabase
// access token (from 01) and attaches it as a Bearer Authorization header —
// the backend's auth interceptor validates it.
import { createClient, type Interceptor } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { MemoryService } from './gen/cosimosi/v1/memory_pb'
import { getAccessToken } from './supabase'

const authHeaderInterceptor: Interceptor = (next) => async (req) => {
  const token = await getAccessToken()
  if (token) {
    req.header.set('Authorization', `Bearer ${token}`)
  }
  return next(req)
}

// Dev → Vite proxy ('/api', rewritten to backend root, avoids CORS); prod/preview
// → backend origin from VITE_API_URL (built assets have no proxy).
const baseUrl = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL

// keepalive lets an in-flight unary request outlive page teardown — needed so the
// recall reinforcement batch flushed on beforeunload/visibilitychange (spec 11, 1.3)
// actually reaches the server. Safe here: the service is unary-only (constitution §6)
// and request bodies are tiny, well under the 64KB keepalive cap.
const keepaliveFetch: typeof fetch = (input, init) => fetch(input, { ...init, keepalive: true })

/** The single Connect transport. Exported (16) so connect-query can mount it on
 *  TransportProvider and build query keys / queryFns against the SAME instance the
 *  imperative client uses — two transports would split the query-key space. */
export const transport = createConnectTransport({
  baseUrl,
  interceptors: [authHeaderInterceptor],
  fetch: keepaliveFetch,
  // 멱등 읽기(GetUniverse·ListDormant — proto NO_SIDE_EFFECTS)는 HTTP GET으로 나간다.
  // connect-go가 GET을 자동 수용; CDN 캐시는 비목표(인증 응답)지만 §4.4가 기록한 방향(16).
  useHttpGet: true,
})

/** Typed client for cosimosi.v1.MemoryService (single service, unary RPCs). */
export const memoryClient = createClient(MemoryService, transport)

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

const transport = createConnectTransport({
  baseUrl,
  interceptors: [authHeaderInterceptor],
})

/** Typed client for cosimosi.v1.MemoryService (single service, unary RPCs). */
export const memoryClient = createClient(MemoryService, transport)

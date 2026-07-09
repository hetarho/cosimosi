import { ConnectError, type Interceptor } from '@connectrpc/connect'

import type { ObservabilityFacade } from './facade.ts'

export const requestIdHeader = 'x-request-id'
const maxRequestIdLength = 128

export function createTelemetryRequestIdInterceptor(
  observability: Pick<ObservabilityFacade, 'setRequestId'>,
  headerName = requestIdHeader,
): Interceptor {
  return (next) => async (req) => {
    try {
      const res = await next(req)
      const requestId = res.header.get(headerName)
      if (isSafeRequestId(requestId)) observability.setRequestId(requestId)
      return res
    } catch (error) {
      const requestId = ConnectError.from(error).metadata.get(headerName)
      if (isSafeRequestId(requestId)) observability.setRequestId(requestId)
      throw error
    }
  }
}

export function isSafeRequestId(value: string | null): value is string {
  return (
    value !== null &&
    value.length > 0 &&
    value.length <= maxRequestIdLength &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  )
}

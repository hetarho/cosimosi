import type { Transport } from '@connectrpc/connect'
import type { ConnectQueryKey } from '@connectrpc/connect-query-core'

import { createPlatformPingQueryKey, createPlatformServiceQueryKey } from '@cosimosi/api-client'

export const platformCacheKeys = {
  service(transport?: Transport): ConnectQueryKey {
    return createPlatformServiceQueryKey(transport)
  },
  ping(transport?: Transport): ConnectQueryKey {
    return createPlatformPingQueryKey(transport)
  },
}

export function isConnectQueryKey(queryKey: readonly unknown[]): queryKey is ConnectQueryKey {
  return queryKey[0] === 'connect-query'
}

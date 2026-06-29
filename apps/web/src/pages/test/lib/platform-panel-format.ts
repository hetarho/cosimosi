import { timestampDate, type PingResponse } from '@cosimosi/api-client'

import { m } from '../../../shared/i18n/index.ts'

export function formatPingServerTime(timestamp: PingResponse['serverTime']): string {
  if (!timestamp || isDefaultTimestamp(timestamp)) return m.test_harness_not_available()
  return timestampDate(timestamp).toISOString()
}

function isDefaultTimestamp(timestamp: NonNullable<PingResponse['serverTime']>): boolean {
  return timestamp.seconds === 0n && timestamp.nanos === 0
}

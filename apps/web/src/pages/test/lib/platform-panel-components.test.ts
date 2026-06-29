import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import type { PingResponse } from '@cosimosi/api-client'

import { formatPingServerTime } from './platform-panel-format.ts'

describe('test harness platform panel formatting', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders the default mock timestamp as not available', () => {
    const timestamp = { seconds: 0n, nanos: 0 } as NonNullable<PingResponse['serverTime']>

    expect(formatPingServerTime(timestamp)).toBe('Not available')
  })

  it('formats a real protobuf timestamp through the api-client timestamp helper', () => {
    const timestamp = { seconds: 1n, nanos: 500_000_000 } as NonNullable<PingResponse['serverTime']>

    expect(formatPingServerTime(timestamp)).toBe('1970-01-01T00:00:01.500Z')
  })
})

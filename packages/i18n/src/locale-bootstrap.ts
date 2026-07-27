import { useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'

import { setActiveLocale, supportedLocales, type Locale } from './locale.ts'

/** Applies the server-owned profile locale after an authenticated profile read settles. */
export function LocaleBootstrap() {
  const transport = useTransport()
  const profile = useQuery(createGetProfileQueryOptions(transport))

  useEffect(() => {
    applyProfileLocale(profile.data?.profile?.locale)
  }, [profile.data?.profile?.locale])

  return null
}

export function applyProfileLocale(locale: string | undefined): void {
  if (supportedLocales.includes(locale as Locale)) setActiveLocale(locale as Locale)
}

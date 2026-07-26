import { useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'
import { setActiveLocale, supportedLocales, type Locale } from '@cosimosi/i18n'

export function LocaleBootstrap() {
  const transport = useTransport()
  const profile = useQuery(createGetProfileQueryOptions(transport))

  useEffect(() => {
    const locale = profile.data?.profile?.locale
    if (supportedLocales.includes(locale as Locale)) setActiveLocale(locale as Locale)
  }, [profile.data?.profile?.locale])

  return null
}

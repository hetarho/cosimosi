import { useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  AuthProviderKind,
  createGetProfileQueryOptions,
  createListAuthProvidersQueryOptions,
} from '@cosimosi/api-client'
import { useAccountSession } from '@cosimosi/auth/react'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export function AccountSection() {
  const transport = useTransport()
  const { userId, signingOut, signOut } = useAccountSession()
  const [confirming, setConfirming] = useState(false)
  const profile = useQuery(createGetProfileQueryOptions(transport))
  const providers = useQuery(createListAuthProvidersQueryOptions(transport))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-text-muted">{m.me_identity_label()}</span>
        <span className="break-all text-right text-text">
          {profile.data?.profile?.email || userId || ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">{m.me_provider_label()}</p>
        <ul className="flex flex-col gap-2">
          {(providers.data?.providers ?? []).map((provider) => {
            const label = providerLabel(provider.kind)
            return label ? (
              <li
                key={`${provider.kind}-${provider.linkedAt}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span>{label}</span>
                <span className="text-text-muted">
                  {m.me_provider_linked_at({ linkedAt: provider.linkedAt })}
                </span>
              </li>
            ) : null
          })}
        </ul>
      </div>
      {confirming ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text">{m.me_sign_out_confirm()}</p>
          <div className="flex shrink-0 gap-2">
            <Button color="neutral" size="sm" onClick={() => setConfirming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              color="neutral"
              size="sm"
              disabled={signingOut}
              onClick={() => {
                // The rejected case is already surfaced on the auth session snapshot; the flag reset in
                // the api keeps the action usable.
                signOut().catch(() => undefined)
              }}
            >
              {m.me_sign_out()}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button color="neutral" size="sm" onClick={() => setConfirming(true)}>
            {m.me_sign_out()}
          </Button>
        </div>
      )}
    </div>
  )
}

function providerLabel(kind: AuthProviderKind): string | null {
  if (kind === AuthProviderKind.GOOGLE) return m.me_provider_google()
  if (kind === AuthProviderKind.PASSWORD) return m.me_provider_password()
  return null
}

import { useState } from 'react'

import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useAccountSession } from '@cosimosi/auth/react'

// The basic account section: the read-only identity line and sign-out behind a plain confirm step
// (never an accidental single tap). Account holds nothing else in v1 — no profile, no credentials,
// no deletion. The confirm is local control-state (idle → confirming), trivial by design (§3.2).
export function AccountSection() {
  const { userId, signingOut, signOut } = useAccountSession()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-text-muted">{m.settings_identity_label()}</span>
        <span className="break-all text-right text-text">{userId ?? ''}</span>
      </div>
      {confirming ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text">{m.settings_sign_out_confirm()}</p>
          <div className="flex shrink-0 gap-2">
            <Button color="neutral" size="sm" onClick={() => setConfirming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              color="neutral"
              size="sm"
              disabled={signingOut}
              onClick={() => {
                // The rejected case is already surfaced on the [04] snapshot; the flag reset in
                // the api keeps the action usable.
                signOut().catch(() => undefined)
              }}
            >
              {m.settings_sign_out()}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button color="neutral" size="sm" onClick={() => setConfirming(true)}>
            {m.settings_sign_out()}
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { Button, Dialog, TextField } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui ([G3]): the charge sheet exposing the two interactive earn
// paths — payment (a single pack, its grant figure from generated config; the store
// receipt goes to the verified Charge, credit lands only after the backend confirms) and
// invite (redeem an inviter's code; the both-sides grant figure from config). There is
// NO login-bonus path — the daily basic grant plays that role ([G3], A8). Control-state
// (which path is in flight) is the stardust machine's; this is presentation, driven by
// props. Figures come only from generated config (CC3), copy is honest and unpressured.
export function ChargeSheet({
  open,
  paying,
  inviting,
  errored,
  onPay,
  onInvite,
  onClose,
}: {
  open: boolean
  paying: boolean
  inviting: boolean
  errored: boolean
  onPay: () => void
  onInvite: (inviteCode: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const busy = paying || inviting

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.twinkle_charge_title()}
      closeLabel={m.common_dismiss()}
    >
      <div className="flex flex-col gap-6">
        {errored ? <p className="text-sm text-danger">{m.twinkle_charge_error()}</p> : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text">{m.twinkle_charge_pay_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_charge_pay_body()}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-base text-text tabular-nums">
              {String(VALUES.twinkle.chargePack)}
            </span>
            <Button color="primary" size="sm" loading={paying} disabled={busy} onClick={onPay}>
              {m.twinkle_charge_pay_action()}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text">{m.twinkle_charge_invite_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_charge_invite_body()}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text-muted">{m.twinkle_charge_invite_bonus_label()}</span>
            <span className="text-sm text-text tabular-nums">
              {String(VALUES.twinkle.earnInviteInvitee)}
            </span>
          </div>
          <TextField
            label={m.twinkle_charge_invite_code_label()}
            placeholder={m.twinkle_charge_invite_code_placeholder()}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              color="primary"
              size="sm"
              loading={inviting}
              disabled={busy || code.trim() === ''}
              onClick={() => onInvite(code.trim())}
            >
              {m.twinkle_charge_invite_action()}
            </Button>
          </div>
        </section>
      </div>
    </Dialog>
  )
}

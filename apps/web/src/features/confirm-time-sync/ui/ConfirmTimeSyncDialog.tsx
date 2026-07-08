import { Button, Dialog } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface ConfirmTimeSyncDialogProps {
  open: boolean
  onAccept: () => void
  onReject: () => void
}

// The reusable sync-consent modal ([T2] case 2 / [R1a]): states the consequence, asks, and returns
// a decision — nothing else. Dismissing (backdrop / ✕ / escape) is the same 아니오 as the button:
// the clock must never move on an ambiguous exit.
export function ConfirmTimeSyncDialog({ open, onAccept, onReject }: ConfirmTimeSyncDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onReject}
      title={m.universe_time_sync_consent_title()}
      closeLabel={m.common_dismiss()}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-text">{m.universe_time_sync_consent_body()}</p>
        <div className="flex items-center justify-end gap-3">
          <Button color="neutral" onClick={onReject}>
            {m.universe_time_sync_reject()}
          </Button>
          <Button color="primary" onClick={onAccept}>
            {m.universe_time_sync_accept()}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

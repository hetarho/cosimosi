import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui ([G3]): the restrained write-earn confirmation. Writing a
// diary earns Twinkle server-side (the write is the writing flow's, [27]); this only
// renders the reward feedback when that launch resolves. No sales language, no decorative
// emoji — a quiet acknowledgement the diarist can dismiss. The amount is generated config
// (passed in, CC3); the balance HUD reflects the authoritative credit on refetch.
export function WriteEarnFeedback({
  amount,
  onDismiss,
}: {
  amount: number
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-surface/95 px-3 py-2 backdrop-blur"
    >
      <span className="text-sm text-text-muted">{m.twinkle_write_earn_notice()}</span>
      <span className="text-sm font-medium text-text tabular-nums">{String(amount)}</span>
      <Button color="neutral" size="sm" onClick={onDismiss}>
        {m.common_dismiss()}
      </Button>
    </div>
  )
}

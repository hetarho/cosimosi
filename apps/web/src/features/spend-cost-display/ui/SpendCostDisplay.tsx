import { SpendKind } from '@cosimosi/api-client'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useSpendQuote } from '../api/quote-spend.ts'
import type { PendingSpend } from '../model/pending-spend.ts'

function costLabel(kind: SpendKind): string {
  if (kind === SpendKind.GIST_VIEW) return m.twinkle_cost_gist_label()
  if (kind === SpendKind.DIARY_RECALL) return m.twinkle_cost_diary_label()
  return m.twinkle_cost_recall_label()
}

// features/spend-cost-display ui ([G4], CC3): the reusable price surface the recall and
// gist-view flows compose before spending. It renders the server quote verbatim — the
// price (recall costlier the deeper the decay, gist cheaper the deeper the gist), whether
// the balance covers it, and on a shortfall the amount short + a charge affordance rather
// than a dead end ([G3]). It returns a decision only through onProceed/onCancel/onCharge
// and never calls spend itself (A4); the composing flow fires the spend on proceed.
export function SpendCostDisplay({
  pending,
  onProceed,
  onCancel,
  onCharge,
}: {
  pending: PendingSpend
  onProceed: () => void
  onCancel: () => void
  onCharge: () => void
}) {
  const query = useSpendQuote(pending)
  const quote = query.data

  if (query.isError) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
        <p className="text-sm text-text-muted">{m.twinkle_cost_error()}</p>
        <div className="flex justify-end">
          <Button color="neutral" size="sm" onClick={onCancel}>
            {m.twinkle_cost_cancel()}
          </Button>
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <p className="rounded-md border border-border bg-surface p-3 text-sm text-text-muted">
        {m.twinkle_cost_loading()}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-muted">{costLabel(pending.kind)}</span>
        <span className="text-base font-medium text-text tabular-nums">{String(quote.cost)}</span>
      </div>

      {quote.covered ? (
        <div className="flex justify-end gap-2">
          <Button color="neutral" size="sm" onClick={onCancel}>
            {m.twinkle_cost_cancel()}
          </Button>
          <Button color="primary" size="sm" onClick={onProceed}>
            {m.twinkle_cost_proceed()}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-text-muted">{m.twinkle_cost_shortfall_label()}</span>
            <span className="text-sm text-text tabular-nums">{String(quote.shortfall)}</span>
          </div>
          <p className="text-sm text-text-muted">{m.twinkle_cost_shortfall_notice()}</p>
          <div className="flex justify-end gap-2">
            <Button color="neutral" size="sm" onClick={onCancel}>
              {m.twinkle_cost_cancel()}
            </Button>
            <Button color="primary" size="sm" onClick={onCharge}>
              {m.twinkle_cost_charge()}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { saveVerdict, useOrnamentPreviewStore, type Ornament } from '@cosimosi/store'
import { ornamentName } from '@cosimosi/store/i18n'
import { Button } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'

// features/buy-ornament ui: the one commit action, and the one place a refusal is explained.
//
// It reads the GENERAL balance alone — an ornament cannot be bought with today's recall allowance, so
// SMALL appears nowhere here ([P9]) — from the shared twinkle mirror rather than a second GetBalance.
// The figure it shows is advisory: the server re-derives the total from what it actually acquires.
export function SaveDecorationButton({
  catalog,
  saving,
  failureReason,
  onSave,
}: {
  readonly catalog: readonly Ornament[]
  readonly saving: boolean
  readonly failureReason: string | null
  readonly onSave: () => void
}) {
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  const confirmed = useOrnamentPreviewStore((state) => state.confirmed)
  // The mirror keeps the balance as bigint (the wire's int64); the verdict's arithmetic is small
  // display sums, so it is narrowed once here rather than threaded as bigint through pure math.
  const generalBalance = Number(useTwinkleBalanceStore((state) => state.general))
  const balanceLoaded = useTwinkleBalanceStore((state) => state.loaded)
  const verdict = saveVerdict({ catalog, previewed, confirmed, generalBalance, balanceLoaded })

  return (
    <div className="flex flex-col gap-2">
      {verdict.kind === 'shortfall' ? (
        <p className="text-xs text-text-muted">
          {m.store_shortfall_notice({
            name: ornamentName(verdict.ornamentId),
            amount: verdict.amount,
          })}
        </p>
      ) : null}
      {verdict.kind === 'locked' ? (
        <p className="text-xs text-text-muted">
          {m.store_locked_notice({ name: ornamentName(verdict.ornamentId) })}
        </p>
      ) : null}
      {/* A server-side refusal reads through the same line as the client's own arithmetic, so a stale
          balance and a fresh one say the same thing. */}
      {failureReason ? <p className="text-xs text-danger">{failureReason}</p> : null}
      <Button
        color="primary"
        loading={saving}
        disabled={saving || verdict.kind === 'shortfall' || verdict.kind === 'locked'}
        onClick={onSave}
      >
        {saving ? m.store_saving_notice() : null}
        {!saving && verdict.kind === 'ready'
          ? m.store_save_action_priced({ amount: verdict.amount })
          : null}
        {!saving && verdict.kind !== 'ready' ? m.store_save_action() : null}
      </Button>
    </div>
  )
}

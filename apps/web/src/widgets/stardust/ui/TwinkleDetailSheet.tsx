import { Dialog } from '@cosimosi/ui'

import { ChargeTwinkleAction } from '../../../features/charge-twinkle/index.ts'
import { EarnGuideSections } from '../../../features/earn-twinkle/index.ts'
import { TwinkleBalanceDetail } from '../../../features/twinkle-balance-hud/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/stardust ui ([G2][G3]): everything 별가루 is, on one surface — what is held, how to come by
// more of it, and how it gathers on its own. It is what the balance reading in the corner opens.
//
// The order is the reader's question order. They pressed a figure, so the figures come FIRST and at a
// size worth having opened something for. The way to get more comes SECOND, because someone who opens
// a balance is usually short of it. How it gathers by itself comes LAST — the longest part, and the
// one a reader in a hurry can leave unread.
//
// It performs nothing itself: it is a composition of three slices that each own their own act, which
// is the only reason a widget may hold them side by side (§3.1). The whole surface is a single
// column with rules between the three, rather than three cards — a panel of stacked plates over a
// live sky reads as a stack of windows, and the dialog is already the one surface here.
export function TwinkleDetailSheet({
  open,
  onOpenAchievements,
  onClose,
}: {
  open: boolean
  onOpenAchievements: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.twinkle_balance_title()}
      closeLabel={m.common_dismiss()}
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm text-text-muted">{m.twinkle_detail_held_label()}</h3>
          <TwinkleBalanceDetail />
        </section>

        <div className="border-t border-border pt-6">
          <ChargeTwinkleAction />
        </div>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h3 className="text-base font-medium text-text">{m.twinkle_earn_title()}</h3>
          <EarnGuideSections onOpenAchievements={onOpenAchievements} />
        </section>
      </div>
    </Dialog>
  )
}

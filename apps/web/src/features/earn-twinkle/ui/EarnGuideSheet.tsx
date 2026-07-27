import { VALUES } from '@cosimosi/config'
import { Button, Dialog } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/earn-twinkle ui ([G3]): the guide a shortfall opens. It explains how 별가루 gathers and
// performs NO mutation — no client, no transport call, no error state — because v2 has no purchase
// path (PRD §8.3) and the other three paths are earned by living in the product, not by pressing a
// button here.
//
// It lists only the REPEATABLE paths. The one-time signup bonus is deliberately absent: naming a
// grant the reader has already received, and cannot receive again, would read as an offer.
//
// Every figure is a generated constant (CC3) — the FE holds no economy number. The one affordance
// leads to where earning is actually claimed.
export function EarnGuideSheet({
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
      title={m.twinkle_earn_title()}
      closeLabel={m.common_dismiss()}
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-text-muted">{m.twinkle_earn_body()}</p>

        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-text">{m.twinkle_earn_daily_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_earn_daily_body()}</p>
          <span className="text-base text-text tabular-nums">
            {String(VALUES.twinkle.smallDailyAmount)}
          </span>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-text">{m.twinkle_earn_write_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_earn_write_body()}</p>
          <span className="text-base text-text tabular-nums">
            {String(VALUES.twinkle.earnWrite)}
          </span>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text">{m.twinkle_earn_achievement_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_earn_achievement_body()}</p>
          <div className="flex justify-end">
            <Button color="primary" size="sm" onClick={onOpenAchievements}>
              {m.twinkle_earn_achievement_action()}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-text">{m.twinkle_earn_invite_title()}</h3>
          <p className="text-sm text-text-muted">{m.twinkle_earn_invite_body()}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text-muted">{m.twinkle_earn_invite_bonus_label()}</span>
            <span className="text-sm text-text tabular-nums">
              {String(VALUES.twinkle.earnInviteInvitee)}
            </span>
          </div>
        </section>
      </div>
    </Dialog>
  )
}

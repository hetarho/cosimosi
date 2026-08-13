import { VALUES } from '@cosimosi/config'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/earn-twinkle ui ([G3]): how 별가루 gathers. It performs NO mutation — no client, no
// transport call, no error state — because the paths it names are earned by living in the product,
// not by pressing a button here.
//
// It lists only the REPEATABLE paths. The one-time signup bonus is deliberately absent: naming a
// grant the reader has already received, and cannot receive again, would read as an offer.
//
// Every figure is a generated constant (CC3) — the FE holds no economy number. The one affordance
// leads to where earning is actually claimed.
//
// SECTIONS, not a surface of its own: this is one part of the 별가루 panel, held beneath the figures
// it explains, where a reader who has just seen how little they hold is already looking. It therefore
// draws no scrim, owns no open state, and starts its headings at `h4` under the group heading its
// host writes.
export function EarnGuideSections({ onOpenAchievements }: { onOpenAchievements: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">{m.twinkle_earn_body()}</p>

      <section className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-text">{m.twinkle_earn_daily_title()}</h4>
        <p className="text-sm text-text-muted">{m.twinkle_earn_daily_body()}</p>
        <span className="text-base text-text tabular-nums">
          {String(VALUES.twinkle.smallDailyAmount)}
        </span>
      </section>

      <section className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-text">{m.twinkle_earn_write_title()}</h4>
        <p className="text-sm text-text-muted">{m.twinkle_earn_write_body()}</p>
        <span className="text-base text-text tabular-nums">{String(VALUES.twinkle.earnWrite)}</span>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-text">{m.twinkle_earn_achievement_title()}</h4>
        <p className="text-sm text-text-muted">{m.twinkle_earn_achievement_body()}</p>
        <div className="flex justify-end">
          <Button color="neutral" size="sm" onClick={onOpenAchievements}>
            {m.twinkle_earn_achievement_action()}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-text">{m.twinkle_earn_invite_title()}</h4>
        <p className="text-sm text-text-muted">{m.twinkle_earn_invite_body()}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-muted">{m.twinkle_earn_invite_bonus_label()}</span>
          <span className="text-sm text-text tabular-nums">
            {String(VALUES.twinkle.earnInviteInvitee)}
          </span>
        </div>
      </section>
    </div>
  )
}

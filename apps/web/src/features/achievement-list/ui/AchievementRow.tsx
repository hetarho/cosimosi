import {
  achievementBody,
  achievementTitle,
  claimState,
  type AchievementView,
} from '@cosimosi/achievement'
import { Button, Progress } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface AchievementRowProps {
  entry: AchievementView
  claiming: boolean
  onClaim: (achievementId: string) => void
}

// One row. The meter reads `progress`/`target` verbatim from the wire, and the affordance comes from
// `claimState` over the three server booleans — there is no local "optimistically claimed" flag, so a
// failed claim cannot leave a row looking paid.
export function AchievementRow({ entry, claiming, onClaim }: AchievementRowProps) {
  const state = claimState(entry)
  const body = achievementBody(entry.id)
  const title = achievementTitle(entry.id)
  // `unpaid` is a claimed row whose reward never landed. It keeps the button — relabelled as a retry
  // — and must NOT also show "received", which is the sentence that made the loss invisible.
  const pressable = state === 'claimable' || state === 'unpaid'

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className="shrink-0 text-xs text-text-subtle">
          {m.achievement_progress_label({ progress: entry.progress, target: entry.target })}
        </span>
      </div>
      {body ? <p className="text-xs text-text-muted">{body}</p> : null}
      <Progress value={entry.progress} max={entry.target} ariaLabel={title} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-subtle">
          {state === 'unpaid'
            ? m.achievement_reward_pending()
            : entry.rewardOrnamentId
              ? m.achievement_reward_ornament()
              : m.achievement_reward_twinkle({ amount: entry.rewardTwinkle })}
        </span>
        {pressable ? (
          <Button size="sm" disabled={claiming} onClick={() => onClaim(entry.id)}>
            {state === 'unpaid' ? m.achievement_claim_retry() : m.achievement_claim()}
          </Button>
        ) : null}
        {state === 'claimed' ? (
          <span className="text-xs text-text-subtle">{m.achievement_claimed()}</span>
        ) : null}
      </div>
    </li>
  )
}

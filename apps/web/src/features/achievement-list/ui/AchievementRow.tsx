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
// `claimState` over the two server booleans — there is no local "optimistically claimed" flag, so a
// failed claim cannot leave a row looking paid.
export function AchievementRow({ entry, claiming, onClaim }: AchievementRowProps) {
  const state = claimState(entry)
  const body = achievementBody(entry.id)
  const title = achievementTitle(entry.id)

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
          {entry.rewardOrnamentId
            ? m.achievement_reward_ornament()
            : m.achievement_reward_twinkle({ amount: entry.rewardTwinkle })}
        </span>
        {state === 'claimable' ? (
          <Button size="sm" disabled={claiming} onClick={() => onClaim(entry.id)}>
            {m.achievement_claim()}
          </Button>
        ) : null}
        {state === 'claimed' ? (
          <span className="text-xs text-text-subtle">{m.achievement_claimed()}</span>
        ) : null}
      </div>
    </li>
  )
}

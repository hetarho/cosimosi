import { StyleSheet, Text, View } from 'react-native'

import {
  achievementBody,
  achievementTitle,
  claimState,
  type AchievementView,
} from '@cosimosi/achievement'
import { Button, Progress, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface AchievementRowProps {
  entry: AchievementView
  claiming: boolean
  onClaim: (achievementId: string) => void
}

// The native fork of the row: same server-verbatim meter and same `claimState` over the three server
// booleans — only the elements differ.
export function AchievementRow({ entry, claiming, onClaim }: AchievementRowProps) {
  const state = claimState(entry)
  const body = achievementBody(entry.id)
  const title = achievementTitle(entry.id)
  const pressable = state === 'claimable' || state === 'unpaid'

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {m.achievement_progress_label({ progress: entry.progress, target: entry.target })}
        </Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <Progress value={entry.progress} max={entry.target} ariaLabel={title} />
      <View style={styles.line}>
        <Text style={styles.meta}>
          {state === 'unpaid'
            ? m.achievement_reward_pending()
            : entry.rewardOrnamentId
              ? m.achievement_reward_ornament()
              : m.achievement_reward_twinkle({ amount: entry.rewardTwinkle })}
        </Text>
        {pressable ? (
          <Button size="sm" disabled={claiming} onPress={() => onClaim(entry.id)}>
            {state === 'unpaid' ? m.achievement_claim_retry() : m.achievement_claim()}
          </Button>
        ) : null}
        {state === 'claimed' ? <Text style={styles.meta}>{m.achievement_claimed()}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  meta: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
})

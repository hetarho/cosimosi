import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { axisLabel, claimableCount, groupByAxis, type AchievementView } from '@cosimosi/achievement'
import {
  useAchievements,
  useClaimAchievement,
  useInvalidateAchievements,
  type ClaimOutcome,
} from '@cosimosi/achievement/react'
import { createGetCatalogQueryKey } from '@cosimosi/api-client'
import { ERROR_REASONS, isReason } from '@cosimosi/errors'
import { asyncCommandMachine } from '@cosimosi/state-machine'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { Skeleton, tokens } from '@cosimosi/ui'
import { useQueryClient } from '@tanstack/react-query'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast, useMachine } from '../../../shared/model/index.ts'
import { AchievementRow } from './AchievementRow.tsx'
import { RewardRevealDialog } from './RewardRevealDialog.tsx'

// The native fork of the tab body. The order, the grouping and the one-claim-in-flight rule are the
// web's verbatim — only the elements differ (§3.5).
export function AchievementList() {
  const { entries, isPending, error } = useAchievements()
  const claim = useClaimAchievement()
  const invalidateBalance = useInvalidateTwinkleBalance()
  const invalidateAchievements = useInvalidateAchievements()
  const queryClient = useQueryClient()
  const showError = useErrorToast()
  const [snapshot, send, actorRef] = useMachine(asyncCommandMachine)
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null)
  const claiming = snapshot.context.status === 'submitting'
  // A claim resolves after an await, by which time the tab may be gone. Everything after that await is
  // fenced: sending to a stopped actor is a warning the mobile test guard fails on, and setting state
  // on an unmounted tree silently loses the reveal either way.
  const mounted = useRef(true)
  useEffect(() => {
    // Set on MOUNT as well as cleared on unmount. React re-runs an effect after its cleanup in
    // development, so a cleanup-only fence latches false on the first remount and every later claim
    // silently discards its own result — which is exactly how this was first written.
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // A failed read must NOT render as "you have no achievements": the catalog is never empty
  // server-side, so an empty list after a failure would be the surface lying about the user's history.
  useEffect(() => {
    if (error) showError(error)
  }, [error, showError])

  const handleClaim = async (achievementId: string) => {
    if (actorRef.getSnapshot().context.status === 'submitting') return
    send({ type: 'SUBMIT', commandId: achievementId })
    const attempt = actorRef.getSnapshot().context.attempt
    try {
      const result = await claim(achievementId)
      if (!mounted.current) return
      send({ type: 'RESOLVE', resultId: achievementId, attempt })
      invalidateBalance()
      if (result.grantedOrnamentId) {
        queryClient
          .invalidateQueries({ queryKey: createGetCatalogQueryKey() })
          .catch(() => undefined)
      }
      setOutcome(result)
    } catch (caught) {
      if (!mounted.current) return
      send({ type: 'REJECT', error: 'claim-failed', attempt })
      showError(caught)
      // Both of these mean the list this press came from was stale, so it is refetched. Every other
      // refusal — including the payout one, where the claim IS recorded — leaves the row as it is so
      // the button stays pressable and the replay can heal it.
      if (
        isReason(caught, ERROR_REASONS.achievementNotAchieved) ||
        isReason(caught, ERROR_REASONS.achievementNotFound)
      ) {
        invalidateAchievements()
      }
    }
  }

  if (isPending) return <Skeleton height={160} />
  if (entries.length === 0) return <Text style={styles.empty}>{m.achievement_empty()}</Text>

  const waiting = claimableCount(entries)
  return (
    <View style={styles.list}>
      <Text style={styles.summary}>
        {waiting > 0
          ? m.achievement_claimable_count({ count: waiting })
          : m.achievement_claimable_none()}
      </Text>
      {groupByAxis(entries).map((group) => (
        <View key={group.axis} style={styles.group}>
          <Text style={styles.axis}>{axisLabel(group.axis)}</Text>
          {group.entries.map((entry: AchievementView) => (
            <AchievementRow
              key={entry.id}
              entry={entry}
              claiming={claiming}
              onClaim={handleClaim}
            />
          ))}
        </View>
      ))}
      <RewardRevealDialog outcome={outcome} onClose={() => setOutcome(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.spacing[5] },
  group: { gap: tokens.spacing[1] },
  axis: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  summary: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  empty: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})

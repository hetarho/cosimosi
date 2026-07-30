import { useEffect, useRef, useState } from 'react'

import { axisLabel, claimableCount, groupByAxis, type AchievementView } from '@cosimosi/achievement'
import {
  useAchievements,
  useClaimAchievement,
  useInvalidateAchievements,
  type ClaimOutcome,
} from '@cosimosi/achievement/react'
import { createGetCatalogQueryKey } from '@cosimosi/api-client'
import { asyncCommandMachine } from '@cosimosi/state-machine'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { Skeleton } from '@cosimosi/ui'
import { useQueryClient } from '@tanstack/react-query'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast, useMachine } from '../../../shared/model/index.ts'
import { AchievementRow } from './AchievementRow.tsx'
import { RewardRevealDialog } from './RewardRevealDialog.tsx'

// The tab body. It renders the server's order VERBATIM — `groupByAxis` only cuts the flat list into
// headings, preserving each group's incoming order — and it sorts, filters and evaluates nothing.
//
// There is one summary and no badge: a count on the tab label or the universe HUD would be a nag, and
// a nag undoes the trade a manual claim is making.
export function AchievementList() {
  const { entries, isPending, error } = useAchievements()
  const claim = useClaimAchievement()
  const invalidateBalance = useInvalidateTwinkleBalance()
  const invalidateAchievements = useInvalidateAchievements()
  const queryClient = useQueryClient()
  const showError = useErrorToast()
  // The shipped async-command machine, keyed on the pressed id: ONE claim in flight at a time, so a
  // second row's button cannot start a second claim.
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
      // The claim hook already invalidated the achievement read; the balance always moved, and the
      // decoration catalog only when an ornament was granted — so it is invalidated only then.
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
      // Every claim refusal refetches, including the payout one. The server now reports a recorded
      // claim whose reward never landed as its own state, so the refetch returns an actionable
      // `unpaid` row instead of hiding the button — and the recovery no longer depends on this
      // component's cache staying stale while a dozen unrelated call sites invalidate it.
      invalidateAchievements()
    }
  }

  if (isPending) return <Skeleton height={160} />
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">{m.achievement_empty()}</p>
  }

  const waiting = claimableCount(entries)
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        {waiting > 0
          ? m.achievement_claimable_count({ count: waiting })
          : m.achievement_claimable_none()}
      </p>
      {groupByAxis(entries).map((group) => (
        <section key={group.axis} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-subtle">
            {axisLabel(group.axis)}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.entries.map((entry: AchievementView) => (
              <AchievementRow
                key={entry.id}
                entry={entry}
                claiming={claiming}
                onClaim={handleClaim}
              />
            ))}
          </ul>
        </section>
      ))}
      <RewardRevealDialog outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  )
}

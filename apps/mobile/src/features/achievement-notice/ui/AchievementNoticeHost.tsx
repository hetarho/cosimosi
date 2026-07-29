import { useCallback, useEffect, useRef } from 'react'

import { useSessionSnapshot } from '@cosimosi/auth/react'

import { achievementTitle } from '@cosimosi/achievement'
import { useAchievementUnlockNotice } from '@cosimosi/achievement/react'
import { VALUES } from '@cosimosi/config'
import { useToastQueue } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The host is a shell: the diff, the cap and the first-resolution silence all live in
// `@cosimosi/achievement` because none of them touch a platform. What is app-side is the copy and the
// toast queue — the two things that genuinely differ.
export function AchievementNoticeHost() {
  const { push, dropByOwner } = useToastQueue()
  const { userId } = useSessionSnapshot()

  const pushNotice = useCallback(
    (message: string) => {
      // One line: what it is and where it waits. No reward figure, no button, no navigation — the tab
      // is where an achievement is confirmed, and the universe must not be interrupted.
      push({
        variant: 'success',
        message,
        durationMs: VALUES.achievement.claimToastMs,
        owner: NOTICE_OWNER,
      })
    },
    [push],
  )
  const formatNotice = useCallback(
    (achievementId: string) => m.achievement_notice({ title: achievementTitle(achievementId) }),
    [],
  )

  // A queued notice must not outlive the session that earned it. The queue sits ABOVE auth because an
  // auth error has to be able to toast, so unmounting this host is not enough on its own — an entry
  // waiting behind a long-dwelling error would surface for whoever signs in next. Watching the signed-in
  // identity is what closes that: it is the one thing this host can see and the queue must never learn.
  //
  // Keyed on a CHANGE rather than done in a cleanup, because React re-runs an effect after its cleanup
  // in development and a cleanup-based drop would throw away the notices this host had just queued.
  const lastUserId = useRef(userId)
  useEffect(() => {
    if (lastUserId.current === userId) return
    lastUserId.current = userId
    dropByOwner(NOTICE_OWNER)
  }, [userId, dropByOwner])

  useAchievementUnlockNotice({ push: pushNotice, formatNotice })
  return null
}

// This host's identity in the shared queue — never a user id, which the queue must not learn.
const NOTICE_OWNER = 'achievement-notice'

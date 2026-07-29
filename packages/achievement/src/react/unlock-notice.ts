import { useEffect, useRef } from 'react'

import { VALUES } from '@cosimosi/config'

import { achievedSnapshot, newlyAchieved, type AchievedSnapshot } from '../unlock-diff.ts'
import { useAchievements } from './achievements.ts'

// The notice's whole behavior, in the package, because it is platform-pure: it renders nothing and
// touches no DOM and no native element. Both apps' hosts are a short shell over this — the body was
// duplicated byte-for-byte at first, which is exactly the drift the promote-on-reuse rule prevents (an
// edit had to be written twice, and the next one would eventually be written once).
//
// It is a DIFF OF A READ ([A5]) rather than a push: the recorder returns `error` alone, so nothing can
// be pushed back through a write, and there is no subscription and no polling.

export interface UnlockNotice {
  /** Push one already-resolved line into the shared toast queue. */
  push: (message: string) => void
  /** Resolve one achievement id to its notice line. The app owns the copy, so it owns this. */
  formatNotice: (achievementId: string) => string
}

export function useAchievementUnlockNotice({ push, formatNotice }: UnlockNotice) {
  const { entries, isSuccess } = useAchievements()
  const previous = useRef<AchievedSnapshot | undefined>(undefined)

  useEffect(() => {
    if (!isSuccess) return
    // The FIRST resolution of a session enqueues nothing: newlyAchieved returns [] for an absent
    // snapshot by construction, so a returning user with unclaimed achievements sees no toast burst.
    const unlocked = newlyAchieved(previous.current, entries)
    previous.current = achievedSnapshot(entries)
    // Capped per resolution, and the rest are DROPPED rather than queued: a diary that crosses several
    // thresholds should read as one moment, and the tab already lists every one of them.
    for (const entry of unlocked.slice(0, VALUES.achievement.unlockNoticeMax)) {
      push(formatNotice(entry.id))
    }
  }, [entries, isSuccess, push, formatNotice])
}

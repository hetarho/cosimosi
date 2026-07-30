import { useEffect, useRef } from 'react'

import {
  achievedSnapshot,
  unlockNoticeToasts,
  type AchievedSnapshot,
  type UnlockNoticeToast,
} from '../unlock-diff.ts'
import { useAchievements } from './achievements.ts'

// The notice's whole behavior, in the package, because it is platform-pure: it renders nothing and
// touches no DOM and no native element. What each app supplies is only what genuinely differs — the
// toast queue it already holds, and the copy — so both hosts are two statements over this.
//
// It is a DIFF OF A READ ([A5]) rather than a push: the recorder returns `error` alone, so nothing can
// be pushed back through a write, and there is no subscription and no polling. The decision itself
// (what to announce, how it reads, the per-resolution cap, the first-resolution silence) is the pure
// `unlockNoticeToasts`; all that is left here is pushing and advancing the snapshot.

/**
 * The narrow slice of the shared toast queue a notice needs, declared structurally so this domain
 * package does not import the UI kit (the shape `@cosimosi/errors`'s toast provider already uses).
 */
export interface NoticeToastQueue {
  push: (entry: UnlockNoticeToast) => void
}

export interface UnlockNotice {
  /** The queue to push into. The app holds it; this package never creates one. */
  queue: NoticeToastQueue
  /**
   * The tag pushed entries carry. `@cosimosi/ui` owns the constant, because the session boundary drops
   * by it — passing it in is what keeps the pushing surface and the dropping surface on one string.
   */
  owner: string
  /** Resolve one achievement id to its notice line. The app owns the copy, so it owns this. */
  formatNotice: (achievementId: string) => string
}

export function useAchievementUnlockNotice({ queue, owner, formatNotice }: UnlockNotice) {
  const { entries, isSuccess } = useAchievements()
  const previous = useRef<AchievedSnapshot | undefined>(undefined)
  // The injected three are held by ref so the effect below depends only on the READ. They belong to
  // the app and are recreated freely on its renders; an effect keyed on their identity would make the
  // hosts responsible for memoizing them, which is precisely the obligation promoting this removed.
  const injected = useRef({ queue, owner, formatNotice })
  useEffect(() => {
    injected.current = { queue, owner, formatNotice }
  })

  useEffect(() => {
    if (!isSuccess) return
    const { queue: toasts, owner: tag, formatNotice: format } = injected.current
    const notices = unlockNoticeToasts(previous.current, entries, {
      owner: tag,
      formatNotice: format,
    })
    previous.current = achievedSnapshot(entries)
    for (const notice of notices) toasts.push(notice)
  }, [entries, isSuccess])
}

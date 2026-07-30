import { achievementTitle } from '@cosimosi/achievement'
import { useAchievementUnlockNotice } from '@cosimosi/achievement/react'
import { ACHIEVEMENT_NOTICE_TOAST_OWNER, useToastQueue } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// A shell, and only a shell: the diff, the cap, the first-resolution silence and the toast's
// composition all live in `@cosimosi/achievement` because none of them touch a platform. What is
// app-side is the queue this app already holds and the copy. The scope-change drop is not here — it
// belongs to the session boundary, beside every other per-user reset.
export function AchievementNoticeHost() {
  const queue = useToastQueue()
  useAchievementUnlockNotice({
    queue,
    owner: ACHIEVEMENT_NOTICE_TOAST_OWNER,
    formatNotice: (achievementId) =>
      m.achievement_notice({ title: achievementTitle(achievementId) }),
  })
  return null
}

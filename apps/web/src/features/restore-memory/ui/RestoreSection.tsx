import { useCallback, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { Button } from '@cosimosi/ui'
import { remainingRestoreDays, useReleasedGroupsStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'
import { useRestoreMemory } from '@cosimosi/universe/react'

// features/restore-memory ui ([X2]): the "지운 일기" section a host mounts. It lists this session's
// released groups (from the Release response — a fresh reload lists none, the accepted v1 limit),
// each with the remaining window derived from `deleted_at` + the generated config retention days
// (never hardcoded), and a 되돌리기 that re-inserts the affected stars. Renders nothing when there
// is nothing to restore.
export function RestoreSection() {
  const groups = useReleasedGroupsStore((state) => state.groups)
  const restore = useRestoreMemory()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const retentionDays = VALUES.release.softDeleteRetentionDays

  const onRestore = useCallback(
    async (diaryId: string) => {
      setPendingId(diaryId)
      setErrorId(null)
      try {
        await restore(diaryId)
      } catch {
        setErrorId(diaryId)
      } finally {
        setPendingId(null)
      }
    },
    [restore],
  )

  if (groups.length === 0) return null

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface/60 p-4">
      <h2 className="text-sm font-medium text-text">{m.deletion_restore_section_title()}</h2>
      <ul className="flex flex-col gap-3">
        {groups.map((group) => {
          const remaining = remainingRestoreDays(group.deletedAt, retentionDays)
          const busy = pendingId === group.diaryId
          return (
            <li
              key={group.diaryId}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-text">
                  {m.deletion_restore_group_summary({ count: group.episodicMemoryIds.length })}
                </span>
                <span className="text-xs text-text-muted">
                  {remaining <= 0
                    ? m.deletion_restore_window_today()
                    : m.deletion_restore_window_remaining({ days: remaining })}
                </span>
                {errorId === group.diaryId && (
                  <span className="text-xs text-danger">{m.deletion_restore_error()}</span>
                )}
              </div>
              <Button
                color="neutral"
                size="sm"
                onClick={() => onRestore(group.diaryId)}
                disabled={busy}
              >
                {busy ? m.deletion_restoring() : m.deletion_restore_action()}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { useCallback, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { Button, Dialog } from '@cosimosi/ui'
import { remainingRestoreDays, useReleasedGroupsStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'
import { useRestoreMemory } from '@cosimosi/universe/react'

// features/restore-memory ui ([X2]): the "지운 일기" way back — a plain word the archive header carries,
// and the list behind it. What was deleted is not what the reader came here for, so it does not hold
// a panel's worth of the page open: it waits as one line and opens on being asked. The list is this
// session's released groups (from the Release response — a fresh reload lists none, the accepted v1
// limit), each with the remaining window derived from `deleted_at` + the generated config retention
// days (never hardcoded), and a 되돌리기 that re-inserts the affected stars.
//
// With nothing to restore it renders NOTHING rather than a disabled word: on almost every load there
// is nothing, and a disabled control claims something is here that cannot be reached right now.
export function RestoreSection() {
  const showError = useErrorToast()
  const [open, setOpen] = useState(false)
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
      } catch (caught) {
        showError(caught)
        setErrorId(diaryId)
      } finally {
        setPendingId(null)
      }
    },
    [restore, showError],
  )

  // Nothing to restore and nothing open: the word itself goes. While the list IS open it stays,
  // even once the last group has been restored — a surface that vanished mid-gesture would take its
  // own scrim and the reader's focus with it, and never say that the restore had worked.
  if (groups.length === 0 && !open) return null

  return (
    <>
      {groups.length > 0 && (
        <div className="flex">
          <Button variant="text" color="neutral" size="sm" onClick={() => setOpen(true)}>
            {m.deletion_restore_section_title()}
          </Button>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={m.deletion_restore_section_title()}
        closeLabel={m.common_dismiss()}
      >
        {groups.length === 0 && (
          <p className="text-sm text-text-muted">{m.deletion_restore_empty()}</p>
        )}
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
      </Dialog>
    </>
  )
}

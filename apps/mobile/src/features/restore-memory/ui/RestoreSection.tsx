import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import { remainingRestoreDays, useReleasedGroupsStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'
import { useRestoreMemory } from '@cosimosi/universe/react'

// features/restore-memory ui (RN fork, [X2]): the "지운 일기" way back — a plain word the archive
// header carries, and the list behind it. What was deleted is not what the reader came here for, so
// it waits as one line and opens on being asked. The list is this session's released groups (from
// the Release response — a fresh reload lists none, the accepted v1 limit), each with the remaining
// window derived from `deleted_at` + the generated config retention days (never hardcoded), and a
// 되돌리기 that re-inserts the affected stars.
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
        <View style={styles.entry}>
          <Button variant="text" color="neutral" size="sm" onPress={() => setOpen(true)}>
            {m.deletion_restore_section_title()}
          </Button>
        </View>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={m.deletion_restore_section_title()}
        closeLabel={m.common_dismiss()}
      >
        <View style={styles.section}>
          {groups.length === 0 && <Text style={styles.window}>{m.deletion_restore_empty()}</Text>}
          {groups.map((group) => {
            const remaining = remainingRestoreDays(group.deletedAt, retentionDays)
            const busy = pendingId === group.diaryId
            return (
              <View key={group.diaryId} style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.summary}>
                    {m.deletion_restore_group_summary({ count: group.episodicMemoryIds.length })}
                  </Text>
                  <Text style={styles.window}>
                    {remaining <= 0
                      ? m.deletion_restore_window_today()
                      : m.deletion_restore_window_remaining({ days: remaining })}
                  </Text>
                  {errorId === group.diaryId && (
                    <Text style={styles.error}>{m.deletion_restore_error()}</Text>
                  )}
                </View>
                <Button
                  color="neutral"
                  size="sm"
                  onPress={() => onRestore(group.diaryId)}
                  disabled={busy}
                >
                  {busy ? m.deletion_restoring() : m.deletion_restore_action()}
                </Button>
              </View>
            )
          })}
        </View>
      </Dialog>
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: tokens.spacing[3],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing[4],
  },
  entry: { alignItems: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  info: { flex: 1, gap: tokens.spacing[1] },
  summary: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  window: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.xs },
})

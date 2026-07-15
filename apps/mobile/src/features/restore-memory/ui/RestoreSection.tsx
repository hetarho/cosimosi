import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { Button, tokens } from '@cosimosi/ui'
import { remainingRestoreDays, useReleasedGroupsStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'
import { useRestoreMemory } from '../api/use-restore.ts'

// features/restore-memory ui (RN fork, [X2]): the "지운 일기" section a host mounts. It lists this
// session's released groups (from the Release response — a fresh reload lists none, the accepted v1
// limit), each with the remaining window derived from `deleted_at` + the generated config retention
// days (never hardcoded), and a 되돌리기 that re-inserts the affected stars. Renders nothing when
// there is nothing to restore.
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
    <View style={styles.section}>
      <Text style={styles.title}>{m.deletion_restore_section_title()}</Text>
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
  )
}

const styles = StyleSheet.create({
  section: {
    gap: tokens.spacing[3],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    padding: tokens.spacing[4],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  info: { flex: 1, gap: 2 },
  summary: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  window: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.xs },
})

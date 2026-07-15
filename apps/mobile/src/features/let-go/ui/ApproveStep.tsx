import { StyleSheet, Text, View } from 'react-native'

import { Button, Checkbox, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { LetGoResourceNotice } from './LetGoResourceNotice.tsx'

// A this-memory-only semantic candidate the AI proposed. `reason` is server-authored text shown
// verbatim (not localizable copy).
export interface LetGoCandidate {
  readonly neuronId: string
  readonly name: string
  readonly reason: string
}

// features/let-go ui step 3 (RN fork, [X4][X6][X7]): review + select-to-seal. The AI suggested the
// candidates; the diarist toggles which to seal (the user decides). The kept-facts statement is
// persistent, the professional-resource notice renders BEFORE the seal action when heavy-state is
// set (advisory, never gating), and the permanence + export reassurance sit at the seal step (no
// undo offered, the diary itself is not deleted).
export function ApproveStep({
  candidates,
  selectedIds,
  onToggle,
  heavyDetected,
  onSeal,
  onBack,
  busy,
  error,
}: {
  candidates: readonly LetGoCandidate[]
  selectedIds: readonly string[]
  onToggle: (neuronId: string) => void
  heavyDetected: boolean
  onSeal: () => void
  onBack: () => void
  busy: boolean
  error: boolean
}) {
  const selected = new Set(selectedIds)
  return (
    <View style={styles.root}>
      {heavyDetected && <LetGoResourceNotice />}

      <Text style={styles.lead}>{m.deletion_letgo_approve_lead()}</Text>

      {candidates.length > 0 ? (
        <View style={styles.list}>
          {candidates.map((candidate) => (
            <View key={candidate.neuronId} style={styles.candidate}>
              <Checkbox
                label={candidate.name}
                checked={selected.has(candidate.neuronId)}
                onCheckedChange={() => onToggle(candidate.neuronId)}
              />
              <Text style={styles.reason}>{candidate.reason}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>{m.deletion_letgo_approve_empty()}</Text>
      )}

      <Text style={styles.muted}>{m.deletion_letgo_kept_facts()}</Text>

      <View style={styles.reassurance}>
        <Text style={styles.body}>{m.deletion_letgo_permanence()}</Text>
        <Text style={styles.muted}>{m.deletion_letgo_export_reassurance()}</Text>
      </View>

      {error && <Text style={styles.error}>{m.deletion_letgo_seal_error()}</Text>}

      <View style={styles.actions}>
        <Button color="neutral" size="sm" onPress={onBack}>
          {m.deletion_letgo_back()}
        </Button>
        <Button
          color="danger"
          size="sm"
          onPress={onSeal}
          disabled={busy || selectedIds.length === 0}
        >
          {busy ? m.deletion_letgo_sealing() : m.deletion_letgo_seal_action()}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[4] },
  lead: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  list: { gap: tokens.spacing[3] },
  candidate: { gap: tokens.spacing[1] },
  reason: {
    paddingLeft: tokens.spacing[6],
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.xs,
  },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  body: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  reassurance: {
    gap: tokens.spacing[1],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    padding: tokens.spacing[3],
  },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})

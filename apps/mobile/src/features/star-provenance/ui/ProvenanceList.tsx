import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import type { ProvenanceEntry, ProvenanceKind, ProvenanceSource } from '@cosimosi/memory'

function kindLabel(kind: ProvenanceKind): string {
  if (kind === 'created') return m.star_provenance_kind_created()
  if (kind === 'semanticized') return m.star_provenance_kind_semanticized()
  return m.star_provenance_kind_reconsolidated()
}

function sourceLabel(source: ProvenanceSource): string {
  if (source === 'original') return m.star_provenance_source_original()
  if (source === 'system') return m.star_provenance_source_system()
  return m.star_provenance_source_user()
}

// features/star-provenance ui ([R8a][D1], RN fork): the time-ordered stage-text list, each entry
// labelled by kind + source; distortion is NOT separately flagged. Renders exactly the ordered
// entries the read returns — ordering and the synthesized baseline are the read's concern.
export function ProvenanceList({
  entries,
  status,
  onRetry,
}: {
  entries: readonly ProvenanceEntry[]
  status: 'loading' | 'retrying' | 'error' | 'success'
  onRetry: () => void
}) {
  if (status === 'loading') {
    return <Text style={styles.note}>{m.star_provenance_loading()}</Text>
  }
  if (status === 'retrying') {
    return <Text style={styles.note}>{m.star_provenance_retrying()}</Text>
  }
  if (status === 'error') {
    return (
      <View style={styles.error} accessibilityRole="alert">
        <Text style={styles.note}>{m.star_provenance_error()}</Text>
        <Button color="neutral" size="sm" onPress={onRetry}>
          {m.common_retry()}
        </Button>
      </View>
    )
  }
  if (entries.length === 0) {
    return <Text style={styles.empty}>{m.star_provenance_empty()}</Text>
  }
  return (
    <View style={styles.list}>
      {entries.map((entry, index) => (
        <View key={`${entry.universeTime}-${index}`} style={styles.entry}>
          <Text style={styles.meta}>
            {kindLabel(entry.kind)} · {sourceLabel(entry.source)} · {entry.universeTime}
          </Text>
          <Text style={styles.text}>{entry.text}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.spacing[3] },
  error: { alignItems: 'flex-start', gap: tokens.spacing[2] },
  entry: { gap: tokens.spacing[1] },
  meta: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  note: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  empty: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, fontStyle: 'italic' },
})

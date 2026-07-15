import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/let-go ui (RN fork) — the professional-resource notice ([X7]). The backend owns the
// heavy-state detection; this only renders when it is set. Gentle, non-blocking, advisory (it gates
// nothing), never phrasing the app as a substitute for care; the resource content is region-aware
// i18n (a Korean-locale default set).
export function LetGoResourceNotice() {
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>{m.deletion_letgo_resource_title()}</Text>
      <Text style={styles.muted}>{m.deletion_letgo_resource_body()}</Text>
      <Text style={styles.body}>{m.deletion_letgo_resource_contact()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: {
    gap: tokens.spacing[1],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    padding: tokens.spacing[3],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  body: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
})

import { useDiaryExport } from '@cosimosi/universe/react/exports'
import { StyleSheet, Text, View } from 'react-native'

import { ExportFormat } from '@cosimosi/api-client'
import { m } from '../../../shared/i18n/index.ts'
import { Button, Card, tokens } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { deliverDiaryExport } from '../lib/deliver-export.ts'

export function ExportDiaries() {
  const { format, setFormat, pending, runExport } = useDiaryExport({
    deliver: deliverDiaryExport,
    onError: useErrorToast(),
  })

  return (
    <Card style={styles.card}>
      <Text style={styles.muted}>{m.me_export_reassurance()}</Text>
      <View style={styles.row}>
        <Button
          size="sm"
          variant={format === ExportFormat.CSV ? 'contained' : 'outlined'}
          onPress={() => setFormat(ExportFormat.CSV)}
          disabled={pending}
        >
          {m.me_export_format_csv()}
        </Button>
        <Button
          size="sm"
          variant={format === ExportFormat.MD ? 'contained' : 'outlined'}
          onPress={() => setFormat(ExportFormat.MD)}
          disabled={pending}
        >
          {m.me_export_format_md()}
        </Button>
      </View>
      <View style={styles.action}>
        <Button size="sm" onPress={runExport} loading={pending}>
          {m.me_export_action()}
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'flex-end' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})

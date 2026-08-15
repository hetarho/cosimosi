import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { createMemoryClient, ExportFormat } from '@cosimosi/api-client'
import { m } from '../../../shared/i18n/index.ts'
import { Button, Card, tokens } from '@cosimosi/ui'

import { useErrorToast } from '../../../shared/model/index.ts'
import { deliverDiaryExport } from '../lib/deliver-export.ts'

export function ExportDiaries() {
  const transport = useTransport()
  const showError = useErrorToast()
  const [format, setFormat] = useState(ExportFormat.CSV)
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (next: ExportFormat) => {
      const response = await createMemoryClient(transport).export({ format: next })
      await deliverDiaryExport(response)
    },
    onError: showError,
  })

  return (
    <Card style={styles.card}>
      <Text style={styles.muted}>{m.me_export_reassurance()}</Text>
      <View style={styles.row}>
        <Button
          size="sm"
          variant={format === ExportFormat.CSV ? 'contained' : 'outlined'}
          onPress={() => setFormat(ExportFormat.CSV)}
          disabled={mutation.isPending}
        >
          {m.me_export_format_csv()}
        </Button>
        <Button
          size="sm"
          variant={format === ExportFormat.MD ? 'contained' : 'outlined'}
          onPress={() => setFormat(ExportFormat.MD)}
          disabled={mutation.isPending}
        >
          {m.me_export_format_md()}
        </Button>
      </View>
      <View style={styles.action}>
        <Button size="sm" onPress={() => mutation.mutate(format)} loading={mutation.isPending}>
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

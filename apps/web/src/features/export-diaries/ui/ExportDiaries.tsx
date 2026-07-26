import { useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { createMemoryClient, ExportFormat } from '@cosimosi/api-client'
import { Button, Card } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
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
      deliverDiaryExport(response)
    },
    onError: showError,
  })

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">{m.me_export_reassurance()}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={format === ExportFormat.CSV ? 'contained' : 'outlined'}
          onClick={() => setFormat(ExportFormat.CSV)}
          disabled={mutation.isPending}
        >
          {m.me_export_format_csv()}
        </Button>
        <Button
          size="sm"
          variant={format === ExportFormat.MD ? 'contained' : 'outlined'}
          onClick={() => setFormat(ExportFormat.MD)}
          disabled={mutation.isPending}
        >
          {m.me_export_format_md()}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutation.mutate(format)} loading={mutation.isPending}>
          {m.me_export_action()}
        </Button>
      </div>
    </Card>
  )
}

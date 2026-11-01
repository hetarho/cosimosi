import { useDiaryExport } from '@cosimosi/universe/react/exports'

import { ExportFormat } from '@cosimosi/api-client'
import { Button, Card } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { m } from '../../../shared/i18n/index.ts'
import { deliverDiaryExport } from '../lib/deliver-export.ts'

export function ExportDiaries() {
  const { format, setFormat, pending, runExport } = useDiaryExport({
    deliver: deliverDiaryExport,
    onError: useErrorToast(),
  })

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">{m.me_export_reassurance()}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={format === ExportFormat.CSV ? 'contained' : 'outlined'}
          onClick={() => setFormat(ExportFormat.CSV)}
          disabled={pending}
        >
          {m.me_export_format_csv()}
        </Button>
        <Button
          size="sm"
          variant={format === ExportFormat.MD ? 'contained' : 'outlined'}
          onClick={() => setFormat(ExportFormat.MD)}
          disabled={pending}
        >
          {m.me_export_format_md()}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={runExport} loading={pending}>
          {m.me_export_action()}
        </Button>
      </div>
    </Card>
  )
}

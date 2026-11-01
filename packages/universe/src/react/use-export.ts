import { useState } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'
import { createMemoryClient, ExportFormat, type ExportResponse } from '@cosimosi/api-client'
import { useCompletionScope } from './use-completion-scope.ts'

export function useDiaryExport({
  deliver,
  onError,
}: {
  deliver(response: ExportResponse): void | Promise<void>
  onError(error: unknown): void
}) {
  const transport = useTransport()
  const capture = useCompletionScope()
  const [format, setFormat] = useState(ExportFormat.CSV)
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (next: ExportFormat) => {
      const isCurrent = capture()
      try {
        const response = await createMemoryClient(transport).export({ format: next })
        if (isCurrent()) await deliver(response)
      } catch (error) {
        if (isCurrent()) onError(error)
        throw error
      }
    },
  })
  return {
    format,
    setFormat,
    pending: mutation.isPending,
    runExport: () => mutation.mutate(format),
  }
}

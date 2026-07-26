import type { ExportResponse } from '@cosimosi/api-client'

/** Decode once, deliver under the server filename, and retain no diary content. */
export function deliverDiaryExport(response: ExportResponse): void {
  const text = new TextDecoder().decode(response.content)
  const blob = new Blob([text], { type: response.contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = response.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

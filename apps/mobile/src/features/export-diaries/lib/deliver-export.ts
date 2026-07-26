import { Share } from 'react-native'

import type { ExportResponse } from '@cosimosi/api-client'

/** Decode once, hand content to the native share sheet, and retain no diary content. */
export async function deliverDiaryExport(response: ExportResponse): Promise<void> {
  const text = new TextDecoder().decode(response.content)
  await Share.share({ message: text, title: response.filename })
}

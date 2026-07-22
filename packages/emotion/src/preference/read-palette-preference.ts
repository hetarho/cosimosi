import type { Transport } from '@connectrpc/connect'

import { createAccountClient } from '@cosimosi/api-client'

// Read the stored palette id (the server returns the default id when the user never chose one). The
// app-init apply calls this on boot; a failed or unauthenticated read is the caller's to catch and
// fall back to the default, so this never swallows the error into a silent wrong color.
export async function readPalettePreference(transport: Transport): Promise<string> {
  const preference = await createAccountClient(transport).getPalettePreference({})
  return preference.paletteId
}

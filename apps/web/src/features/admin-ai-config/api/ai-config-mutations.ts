import { useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useMutation } from '@tanstack/react-query'

import { createAdminClient, type AICapability } from '@cosimosi/api-client'

// features/admin-ai-config api: the console's three AI-config writes. The ui reads `isPending` for its
// busy state and passes its own success and error handling per call.

function useAdminClient() {
  const transport = useTransport()
  return useMemo(() => createAdminClient(transport), [transport])
}

/** Store a provider's key, encrypted at rest; the key never comes back over the wire (ADMIN-11). */
export function useSetProviderKey() {
  const client = useAdminClient()
  return useMutation({
    mutationFn: (input: { provider: string; apiKey: string }) => client.setProviderKey(input),
  })
}

/** Remove a provider's stored key row. */
export function useClearProviderKey() {
  const client = useAdminClient()
  return useMutation({
    mutationFn: (input: { provider: string }) => client.clearProviderKey(input),
  })
}

/** Select one capability's provider and model (ADMIN-12). */
export function useSetAIConfig() {
  const client = useAdminClient()
  return useMutation({
    mutationFn: (input: { capability: AICapability; provider: string; model: string }) =>
      client.setAIConfig(input),
  })
}

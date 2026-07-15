import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'

import {
  AccountService,
  PalettePreferenceSchema,
  type SetPalettePreferenceRequest,
} from './gen/cosimosi/account/v1/account_pb.ts'

export { AccountService } from './gen/cosimosi/account/v1/account_pb.ts'
export type {
  GetPalettePreferenceRequest,
  PalettePreference,
  SetPalettePreferenceRequest,
} from './gen/cosimosi/account/v1/account_pb.ts'

export function createAccountClient(transport: Transport): Client<typeof AccountService> {
  return createClient(AccountService, transport)
}

// Persist the chosen palette id; resolves to the stored preference (the server echoes the id it
// kept). This is only the persistence call — applying the color swap is the caller's, so a single
// seam owns the re-color.
export function setPalettePreference(transport: Transport, paletteId: string) {
  return createAccountClient(transport).setPalettePreference({ paletteId })
}

export function createAccountServiceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService,
    transport,
    cardinality: undefined,
  })
}

export function createGetPalettePreferenceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.getPalettePreference,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetPalettePreferenceQueryOptions(transport: Transport) {
  return createQueryOptions(AccountService.method.getPalettePreference, {}, { transport })
}

export function createAccountMockTransport(handlers: {
  getPalettePreference?: () => MessageInitShape<typeof PalettePreferenceSchema>
  setPalettePreference?: (
    request: SetPalettePreferenceRequest,
  ) => MessageInitShape<typeof PalettePreferenceSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(AccountService, {
      getPalettePreference() {
        return handlers.getPalettePreference?.() ?? {}
      },
      setPalettePreference(request) {
        return handlers.setPalettePreference?.(request) ?? { paletteId: request.paletteId }
      },
    })
  })
}

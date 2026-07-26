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
  GetProfileResponseSchema,
  PalettePreferenceSchema,
  SignUpRequestSchema,
  SignUpResponseSchema,
  type SignUpRequest,
  type SetPalettePreferenceRequest,
} from './gen/cosimosi/account/v1/account_pb.ts'

export { AccountService } from './gen/cosimosi/account/v1/account_pb.ts'
export type {
  GetPalettePreferenceRequest,
  GetProfileRequest,
  GetProfileResponse,
  PalettePreference,
  Profile,
  SignUpRequest,
  SignUpResponse,
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

export function signUp(
  transport: Transport,
  request: MessageInitShape<typeof SignUpRequestSchema>,
) {
  return createAccountClient(transport).signUp(request)
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

export function createGetProfileQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.getProfile,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetProfileQueryOptions(transport: Transport) {
  return createQueryOptions(AccountService.method.getProfile, {}, { transport })
}

export function createAccountMockTransport(handlers: {
  getProfile?: () => MessageInitShape<typeof GetProfileResponseSchema>
  signUp?: (request: SignUpRequest) => MessageInitShape<typeof SignUpResponseSchema>
  getPalettePreference?: () => MessageInitShape<typeof PalettePreferenceSchema>
  setPalettePreference?: (
    request: SetPalettePreferenceRequest,
  ) => MessageInitShape<typeof PalettePreferenceSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(AccountService, {
      getProfile() {
        return handlers.getProfile?.() ?? {}
      },
      signUp(request) {
        return (
          handlers.signUp?.(request) ?? {
            nickname: request.nickname,
            timezone: request.timezone,
            locale: request.locale,
            inviteBound: false,
          }
        )
      },
      getPalettePreference() {
        return handlers.getPalettePreference?.() ?? {}
      },
      setPalettePreference(request) {
        return handlers.setPalettePreference?.(request) ?? { paletteId: request.paletteId }
      },
    })
  })
}

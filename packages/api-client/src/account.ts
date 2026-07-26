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
  GetInviteLinkResponseSchema,
  GetProfileResponseSchema,
  ListAuthProvidersResponseSchema,
  PalettePreferenceSchema,
  SignUpRequestSchema,
  SignUpResponseSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
  WithdrawResponseSchema,
  type SignUpRequest,
  type SetPalettePreferenceRequest,
  type UpdateProfileRequest,
} from './gen/cosimosi/account/v1/account_pb.ts'

export { AccountService, AuthProviderKind } from './gen/cosimosi/account/v1/account_pb.ts'
export type {
  GetInviteLinkResponse,
  GetPalettePreferenceRequest,
  GetProfileRequest,
  GetProfileResponse,
  LinkedAuthProvider,
  ListAuthProvidersResponse,
  PalettePreference,
  Profile,
  SignUpRequest,
  SignUpResponse,
  SetPalettePreferenceRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  WithdrawResponse,
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

export function updateProfile(
  transport: Transport,
  request: MessageInitShape<typeof UpdateProfileRequestSchema>,
) {
  return createAccountClient(transport).updateProfile(request)
}

export function withdraw(transport: Transport) {
  return createAccountClient(transport).withdraw({})
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

export function createListAuthProvidersQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.listAuthProviders,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createListAuthProvidersQueryOptions(transport: Transport) {
  return createQueryOptions(AccountService.method.listAuthProviders, {}, { transport })
}

export function createGetInviteLinkQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.getInviteLink,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetInviteLinkQueryOptions(transport: Transport) {
  return createQueryOptions(AccountService.method.getInviteLink, {}, { transport })
}

export function createAccountMockTransport(handlers: {
  getProfile?: () => MessageInitShape<typeof GetProfileResponseSchema>
  signUp?: (request: SignUpRequest) => MessageInitShape<typeof SignUpResponseSchema>
  updateProfile?: (
    request: UpdateProfileRequest,
  ) => MessageInitShape<typeof UpdateProfileResponseSchema>
  listAuthProviders?: () => MessageInitShape<typeof ListAuthProvidersResponseSchema>
  getInviteLink?: () => MessageInitShape<typeof GetInviteLinkResponseSchema>
  withdraw?: () => MessageInitShape<typeof WithdrawResponseSchema>
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
      updateProfile(request) {
        return (
          handlers.updateProfile?.(request) ?? {
            profile: {
              nickname: request.nickname,
              timezone: request.timezone,
              locale: request.locale,
            },
          }
        )
      },
      listAuthProviders() {
        return handlers.listAuthProviders?.() ?? { providers: [] }
      },
      getInviteLink() {
        return handlers.getInviteLink?.() ?? {}
      },
      withdraw() {
        return handlers.withdraw?.() ?? {}
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

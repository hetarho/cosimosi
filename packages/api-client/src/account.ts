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
  GetMoodColorsResponseSchema,
  GetMoodColorStatsResponseSchema,
  GetProfileResponseSchema,
  ListAuthProvidersResponseSchema,
  MoodColorSchema,
  SignUpRequestSchema,
  SignUpResponseSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
  WithdrawResponseSchema,
  type SignUpRequest,
  type SetMoodColorRequest,
  type UpdateProfileRequest,
} from './gen/cosimosi/account/v1/account_pb.ts'

export { AccountService, AuthProviderKind } from './gen/cosimosi/account/v1/account_pb.ts'
export type {
  GetInviteLinkResponse,
  GetMoodColorsResponse,
  GetMoodColorStatsResponse,
  GetProfileRequest,
  GetProfileResponse,
  LinkedAuthProvider,
  ListAuthProvidersResponse,
  MoodColor,
  MoodColorStat,
  Profile,
  SignUpRequest,
  SignUpResponse,
  SetMoodColorRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  WithdrawResponse,
} from './gen/cosimosi/account/v1/account_pb.ts'

export function createAccountClient(transport: Transport): Client<typeof AccountService> {
  return createClient(AccountService, transport)
}

export function setMoodColor(transport: Transport, mood: string, color: string) {
  return createAccountClient(transport).setMoodColor({ mood, color })
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

export function createGetMoodColorsQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.getMoodColors,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetMoodColorsQueryOptions(transport: Transport) {
  return createQueryOptions(AccountService.method.getMoodColors, {}, { transport })
}

export function createGetMoodColorStatsQueryKey(mood: string, transport?: Transport) {
  return createConnectQueryKey({
    schema: AccountService.method.getMoodColorStats,
    input: { mood },
    transport,
    cardinality: 'finite',
  })
}

export function createGetMoodColorStatsQueryOptions(transport: Transport, mood: string) {
  return createQueryOptions(AccountService.method.getMoodColorStats, { mood }, { transport })
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
  getMoodColors?: () => MessageInitShape<typeof GetMoodColorsResponseSchema>
  setMoodColor?: (request: SetMoodColorRequest) => MessageInitShape<typeof MoodColorSchema>
  getMoodColorStats?: (mood: string) => MessageInitShape<typeof GetMoodColorStatsResponseSchema>
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
      getMoodColors() {
        return handlers.getMoodColors?.() ?? { colors: [] }
      },
      setMoodColor(request) {
        return handlers.setMoodColor?.(request) ?? { mood: request.mood, color: request.color }
      },
      getMoodColorStats(request) {
        return handlers.getMoodColorStats?.(request.mood) ?? { stats: [] }
      },
    })
  })
}

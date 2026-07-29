import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'
import type { MessageInitShape } from '@bufbuild/protobuf'

import {
  type ClaimAchievementRequest,
  type ClaimAchievementRequestSchema,
  type ClaimAchievementResponseSchema,
  type ListAchievementsResponseSchema,
  AchievementService,
} from './gen/cosimosi/achievement/v1/achievement_pb.ts'

export {
  AchievementAxis,
  AchievementService,
} from './gen/cosimosi/achievement/v1/achievement_pb.ts'
export type {
  AchievementEntry,
  ClaimAchievementRequest,
  ClaimAchievementResponse,
  ListAchievementsResponse,
} from './gen/cosimosi/achievement/v1/achievement_pb.ts'

export function createAchievementClient(transport: Transport): Client<typeof AchievementService> {
  return createClient(AchievementService, transport)
}

export function createListAchievementsQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: AchievementService.method.listAchievements,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createListAchievementsQueryOptions(transport: Transport) {
  return createQueryOptions(AchievementService.method.listAchievements, {}, { transport })
}

/** The one achievement write: stamps the claim and pays its single reward leg. The request carries
 *  no amount — a client cannot propose what it earned. */
export function claimAchievement(
  transport: Transport,
  request: MessageInitShape<typeof ClaimAchievementRequestSchema>,
) {
  return createAchievementClient(transport).claimAchievement(request)
}

export function createAchievementMockTransport(handlers: {
  listAchievements?: () => MessageInitShape<typeof ListAchievementsResponseSchema>
  claimAchievement?: (
    request: ClaimAchievementRequest,
  ) => MessageInitShape<typeof ClaimAchievementResponseSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(AchievementService, {
      listAchievements() {
        return handlers.listAchievements?.() ?? { entries: [] }
      },
      claimAchievement(request) {
        return (
          handlers.claimAchievement?.(request) ?? {
            grantedTwinkle: 0n,
            grantedOrnamentId: '',
            twinkleTotal: 0n,
          }
        )
      },
    })
  })
}

import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'
import type { MessageInitShape } from '@bufbuild/protobuf'

import {
  type ListAchievementsResponseSchema,
  AchievementService,
} from './gen/cosimosi/achievement/v1/achievement_pb.ts'

export {
  AchievementAxis,
  AchievementService,
} from './gen/cosimosi/achievement/v1/achievement_pb.ts'
export type {
  AchievementEntry,
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

export function createAchievementMockTransport(handlers: {
  listAchievements?: () => MessageInitShape<typeof ListAchievementsResponseSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(AchievementService, {
      listAchievements() {
        return handlers.listAchievements?.() ?? { entries: [] }
      },
    })
  })
}

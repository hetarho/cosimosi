import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import {
  createConnectQueryKey,
  createInfiniteQueryOptions,
  createQueryOptions,
} from '@connectrpc/connect-query-core'

import { GetUniverseResponseSchema, MemoryService } from './gen/cosimosi/memory/v1/memory_pb.ts'

export { MemoryService } from './gen/cosimosi/memory/v1/memory_pb.ts'
export type {
  ConfirmedMemory,
  DiaryDto,
  DiarySplitRef,
  EmotionDto,
  EpisodicMemoryDto,
  GetDiariesRequest,
  GetDiariesResponse,
  GetUniverseRequest,
  GetUniverseResponse,
  LaunchStarsRequest,
  LaunchStarsResponse,
  NeuronActivationDto,
  NeuronDto,
  ProposedMemory,
  ProposedNeuron,
  RecallDiaryStarsRequest,
  RecallDiaryStarsResponse,
  RecallRequest,
  RecallResponse,
  ReviseSplitRequest,
  SplitDiaryRequest,
  SplitDiaryResponse,
  SynapseDto,
  ViewSemanticRequest,
  ViewSemanticResponse,
} from './gen/cosimosi/memory/v1/memory_pb.ts'

export function createMemoryClient(transport: Transport): Client<typeof MemoryService> {
  return createClient(MemoryService, transport)
}

export function createMemoryMockTransport(
  getUniverse: () => MessageInitShape<typeof GetUniverseResponseSchema>,
): Transport {
  return createRouterTransport(({ service }) => {
    service(MemoryService, {
      getUniverse() {
        return getUniverse()
      },
    })
  })
}

export function createMemoryServiceQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: MemoryService,
    transport,
    cardinality: undefined,
  })
}

export function createGetUniverseQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: MemoryService.method.getUniverse,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetUniverseQueryOptions(transport: Transport) {
  return createQueryOptions(MemoryService.method.getUniverse, {}, { transport })
}

export function createGetDiariesQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: MemoryService.method.getDiaries,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetDiariesQueryOptions(
  input: MessageInitShape<typeof MemoryService.method.getDiaries.input>,
  transport: Transport,
) {
  return createQueryOptions(MemoryService.method.getDiaries, input, { transport })
}

// The diary archive read is paginated (reverse-chronological by diary_date, [D2]): page_token
// carries the opaque cursor, an empty next_page_token marks the last page. The caller passes the
// page size (config-owned, never hardcoded here); 0 lets the server apply its default/clamp.
export function createGetDiariesInfiniteQueryOptions(transport: Transport, pageSize: number) {
  return createInfiniteQueryOptions(
    MemoryService.method.getDiaries,
    { pageSize, pageToken: '' },
    {
      transport,
      pageParamKey: 'pageToken',
      getNextPageParam: (lastPage) =>
        lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken,
    },
  )
}

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
  HeavyState,
  LaunchStarsRequest,
  LaunchStarsResponse,
  LetGoRequest,
  LetGoResponse,
  NeuronActivationDto,
  NeuronDto,
  ProposedMemory,
  ProposedNeuron,
  RecallDiaryStarsRequest,
  RecallDiaryStarsResponse,
  RecallRequest,
  RecallResponse,
  ReleaseRequest,
  ReleaseResponse,
  RestoreRequest,
  RestoreResponse,
  ReviseSplitRequest,
  SealCandidate,
  SplitDiaryRequest,
  SplitDiaryResponse,
  SuggestLetGoRequest,
  SuggestLetGoResponse,
  SynapseDto,
  SyncStatusRequest,
  SyncStatusResponse,
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

// The server-authoritative sync-status read ([R1a]): the client drives the sync-consent decision
// from `needsSync` here, never a local Date. Free/GET-eligible, so it caches like the other reads;
// a recall/diary-recall that advances the clock invalidates it alongside GetUniverse.
export function createSyncStatusQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: MemoryService.method.syncStatus,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createSyncStatusQueryOptions(transport: Transport) {
  return createQueryOptions(MemoryService.method.syncStatus, {}, { transport })
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

// The invalidation key for the PAGINATED archive read — derived from the same options the reader
// registers, so it matches exactly. The finite GetDiaries key does NOT match the infinite query,
// so a mutation that changes the archive (release/restore) must invalidate this one for the
// reader's live-memory chips + per-diary actions to refresh.
export function createGetDiariesInfiniteQueryKey(transport: Transport, pageSize: number) {
  return createGetDiariesInfiniteQueryOptions(transport, pageSize).queryKey
}

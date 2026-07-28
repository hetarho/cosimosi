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
export { DiarySort, ExportFormat } from './gen/cosimosi/memory/v1/memory_pb.ts'
export type {
  ConfirmedMemory,
  DiaryDayDto,
  DiaryDayMoodDto,
  DiaryDto,
  DiarySplitRef,
  EmotionDto,
  EpisodicMemoryDto,
  ExportRequest,
  ExportResponse,
  GetDiariesRequest,
  GetDiariesResponse,
  GetDiaryCalendarRequest,
  GetDiaryCalendarResponse,
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

export type GetDiariesInput = MessageInitShape<typeof MemoryService.method.getDiaries.input>
export type GetDiaryCalendarInput = MessageInitShape<
  typeof MemoryService.method.getDiaryCalendar.input
>

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

// The request input is part of the key, while page_token is replaced by each keyset page cursor.
export function createGetDiariesInfiniteQueryOptions(transport: Transport, input: GetDiariesInput) {
  return createInfiniteQueryOptions(
    MemoryService.method.getDiaries,
    { ...input, pageToken: '' },
    {
      transport,
      pageParamKey: 'pageToken',
      getNextPageParam: (lastPage) =>
        lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken,
    },
  )
}

// Omitting input makes this a partial key for every search/filter/sort variant. The finite
// GetDiaries key still does NOT match because its cardinality differs.
export function createGetDiariesInfiniteQueryKey(transport: Transport) {
  return createConnectQueryKey({
    schema: MemoryService.method.getDiaries,
    transport,
    cardinality: 'infinite',
  })
}

// The calendar month read ([D12]). The from/to range is part of the key, so stepping to another month is
// a new key and a natural fetch; page_token is replaced by each keyset day cursor. Free and time-frozen
// (NO_SIDE_EFFECTS): the request carries no consent, no operation id and no search query, and the method
// already holds its single http-policy classification — a second one hard-fails the transport (§2.7).
export function createGetDiaryCalendarInfiniteQueryOptions(
  transport: Transport,
  input: GetDiaryCalendarInput,
) {
  return createInfiniteQueryOptions(
    MemoryService.method.getDiaryCalendar,
    { ...input, pageToken: '' },
    {
      transport,
      pageParamKey: 'pageToken',
      getNextPageParam: (lastPage) =>
        lastPage.nextPageToken === '' ? undefined : lastPage.nextPageToken,
    },
  )
}

// Omitting input makes this a partial key for every month, so one invalidation refreshes them all.
export function createGetDiaryCalendarInfiniteQueryKey(transport: Transport) {
  return createConnectQueryKey({
    schema: MemoryService.method.getDiaryCalendar,
    transport,
    cardinality: 'infinite',
  })
}

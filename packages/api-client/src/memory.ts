import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'

import { GetUniverseResponseSchema, MemoryService } from './gen/cosimosi/memory/v1/memory_pb.ts'

export { MemoryService } from './gen/cosimosi/memory/v1/memory_pb.ts'
export type {
  ConfirmedMemory,
  EmotionDto,
  EpisodicMemoryDto,
  GetUniverseRequest,
  GetUniverseResponse,
  LaunchStarsRequest,
  LaunchStarsResponse,
  NeuronActivationDto,
  NeuronDto,
  ProposedMemory,
  ProposedNeuron,
  ReviseSplitRequest,
  SplitDiaryRequest,
  SplitDiaryResponse,
  SynapseDto,
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

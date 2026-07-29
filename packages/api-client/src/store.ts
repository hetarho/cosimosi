import type { MessageInitShape } from '@bufbuild/protobuf'
import {
  createClient,
  createRouterTransport,
  type Client,
  type Transport,
} from '@connectrpc/connect'
import { createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query-core'

import {
  DecorateRequestSchema,
  DecorateResponseSchema,
  type DecorateRequest,
  GetCatalogResponseSchema,
  GetSelectionResponseSchema,
  StoreService,
} from './gen/cosimosi/store/v1/store_pb.ts'

export {
  OrnamentAcquisition,
  OrnamentKind,
  StoreService,
} from './gen/cosimosi/store/v1/store_pb.ts'
export type {
  DecorateRequest,
  DecorateResponse,
  GetCatalogResponse,
  GetSelectionResponse,
  Ornament,
  OrnamentSelection,
} from './gen/cosimosi/store/v1/store_pb.ts'

export function createStoreClient(transport: Transport): Client<typeof StoreService> {
  return createClient(StoreService, transport)
}

/** The one decoration write: buy the unowned members of the selection and apply it, atomically. The
 *  request carries no amount — the charge is the server's, derived from what it actually acquired. */
export function decorate(
  transport: Transport,
  request: MessageInitShape<typeof DecorateRequestSchema>,
) {
  return createStoreClient(transport).decorate(request)
}

export function createGetCatalogQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: StoreService.method.getCatalog,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetCatalogQueryOptions(transport: Transport) {
  return createQueryOptions(StoreService.method.getCatalog, {}, { transport })
}

export function createGetSelectionQueryKey(transport?: Transport) {
  return createConnectQueryKey({
    schema: StoreService.method.getSelection,
    input: {},
    transport,
    cardinality: 'finite',
  })
}

export function createGetSelectionQueryOptions(transport: Transport) {
  return createQueryOptions(StoreService.method.getSelection, {}, { transport })
}

export function createStoreMockTransport(handlers: {
  getCatalog?: () => MessageInitShape<typeof GetCatalogResponseSchema>
  getSelection?: () => MessageInitShape<typeof GetSelectionResponseSchema>
  decorate?: (request: DecorateRequest) => MessageInitShape<typeof DecorateResponseSchema>
}): Transport {
  return createRouterTransport(({ service }) => {
    service(StoreService, {
      getCatalog() {
        return handlers.getCatalog?.() ?? { ornaments: [] }
      },
      getSelection() {
        return handlers.getSelection?.() ?? { selections: [] }
      },
      decorate(request) {
        return handlers.decorate?.(request) ?? { selection: [], spentTwinkle: 0n }
      },
    })
  })
}

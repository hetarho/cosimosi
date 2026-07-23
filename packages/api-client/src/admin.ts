import { createClient, type Client, type Transport } from '@connectrpc/connect'
import { createQueryOptions } from '@connectrpc/connect-query-core'

import { AdminService } from './gen/cosimosi/admin/v1/admin_pb.ts'

export { AdminService } from './gen/cosimosi/admin/v1/admin_pb.ts'
export {
  AICapability,
  type AdminEntry,
  type AdminUser,
  type AICapabilityConfig,
  type GetAdminSelfResponse,
  type GetAIConfigResponse,
  type GetAIUsageResponse,
  type GetJobHealthResponse,
  type GrantStardustRequest,
  type ListAdminsResponse,
  type ListTwinkleGrantsResponse,
  type ListUsersResponse,
  type SetAIConfigRequest,
  type TwinkleGrant,
} from './gen/cosimosi/admin/v1/admin_pb.ts'

export function createAdminClient(transport: Transport): Client<typeof AdminService> {
  return createClient(AdminService, transport)
}

// The read query-options the admin console renders. Each read is NO_SIDE_EFFECTS (GET-eligible) and
// classified user-scoped (never shared-CDN) in @cosimosi/client-cache.
export function createGetAdminSelfQueryOptions(transport: Transport) {
  return createQueryOptions(AdminService.method.getAdminSelf, {}, { transport })
}

export function createListAdminsQueryOptions(transport: Transport) {
  return createQueryOptions(AdminService.method.listAdmins, {}, { transport })
}

export function createListUsersQueryOptions(
  transport: Transport,
  input: { page?: number; pageSize?: number; query?: string } = {},
) {
  return createQueryOptions(AdminService.method.listUsers, input, { transport })
}

export function createListTwinkleGrantsQueryOptions(
  transport: Transport,
  input: { page?: number; pageSize?: number } = {},
) {
  return createQueryOptions(AdminService.method.listTwinkleGrants, input, { transport })
}

export function createGetAIConfigQueryOptions(transport: Transport) {
  return createQueryOptions(AdminService.method.getAIConfig, {}, { transport })
}

export function createGetAIUsageQueryOptions(transport: Transport) {
  return createQueryOptions(AdminService.method.getAIUsage, {}, { transport })
}

export function createGetJobHealthQueryOptions(transport: Transport) {
  return createQueryOptions(AdminService.method.getJobHealth, {}, { transport })
}

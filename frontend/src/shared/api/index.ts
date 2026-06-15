// shared/api Public API — 명시 export만 (배럴 `export *` 금지, FSD 공개 API 규칙).
export { supabase, getAccessToken } from './supabase'
export { memoryClient, transport } from './transport'
// proto 계약 타입/값 — gen/은 슬라이스 내부이므로 소비처는 이 공개 API로만 가져온다(FSD §2.5).
export {
  Mood,
  MemoryService,
  SettingsService,
  RecordSchema,
  StarSchema,
  SynapseSchema,
  GetUniverseResponseSchema,
  ListDormantResponseSchema,
  ListRecordsResponseSchema,
  RecordSummarySchema,
  GetSettingsResponseSchema,
} from './gen/cosimosi/v1/memory_pb'
export type {
  Star,
  Record,
  Synapse,
  AmbientMood,
  GetUniverseResponse,
  ListDormantResponse,
  RecordSummary,
  ListRecordsResponse,
  EvolutionSnapshot,
  GetEvolutionHistoryResponse,
  Settings,
  GetSettingsResponse,
} from './gen/cosimosi/v1/memory_pb'
// 우주 공개 계약(spec 35) — ShareService(인증, 소유자 설정) + VisitService(무인증 공개 방문).
export { VisitService, ShareService, GetShareSettingsResponseSchema } from './gen/cosimosi/v1/share_pb'
export type {
  SharedStar,
  SharedSynapse,
  GetSharedUniverseResponse,
  GetShareSettingsResponse,
  UpdateShareSettingsResponse,
  RotateShareSlugResponse,
} from './gen/cosimosi/v1/share_pb'
// 관리자 콘솔 계약(spec 34) — AdminService는 서버 allowlist 게이트 뒤에 있다.
export { AdminService } from './gen/cosimosi/v1/admin_pb'
export type {
  ProviderConfig,
  GetLLMConfigResponse,
  GetAdminOverviewResponse,
  TestProviderKeyResponse,
  UsageRow,
  DayCount,
} from './gen/cosimosi/v1/admin_pb'

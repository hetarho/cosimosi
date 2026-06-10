// shared/api Public API — 명시 export만 (배럴 `export *` 금지, FSD 공개 API 규칙).
export { supabase, getAccessToken } from './supabase'
export { memoryClient, transport } from './transport'
// proto 계약 타입/값 — gen/은 슬라이스 내부이므로 소비처는 이 공개 API로만 가져온다(FSD §2.5).
export {
  Mood,
  MemoryService,
  RecordSchema,
  StarSchema,
  SynapseSchema,
  GetUniverseResponseSchema,
  ListDormantResponseSchema,
} from './gen/cosimosi/v1/memory_pb'
export type {
  Star,
  Record,
  Synapse,
  GetUniverseResponse,
  ListDormantResponse,
} from './gen/cosimosi/v1/memory_pb'

// GetUniverse query layer (spec 16): connect-query options (key + transport-bound
// queryFn) and the query→store sync. Replaces the imperative get-universe loader —
// loading/error/refetch live in the consuming page's useQuery now. No three/React/DOM
// (constitution §4·3.2); queryOptions/createQueryOptions are plain option builders.
import { callUnaryMethod, createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  GetUniverseResponseSchema,
  MemoryService,
  transport,
  type GetUniverseResponse,
} from '@/shared/api'
import { demoStars, demoSynapses, isDemoMode, virtualNowMs } from '@/shared/lib/demo'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse/@x/memory'
import { starBrightness } from '../model/activation'
import { deriveAmbient, type AmbientStar } from '../model/ambient'
import { mergeEdges, mergeStars } from '../model/merge'
import { useMemoryStore } from '../model/store'
import { parseEpochMs } from '../model/time'
import { mapStar } from './map-star'

/** StarNode[] → the affect-only shape the ambient derivations read. */
function ambientStarsOf(stars: { memory: AmbientStar }[]): AmbientStar[] {
  return stars.map((s) => ({
    mood: s.memory.mood,
    intensity: s.memory.intensity,
    valence: s.memory.valence,
    lastRecalledAt: s.memory.lastRecalledAt,
  }))
}

// 단일 작성자 우주(spec 16 §캐싱 전략): 시간 만료가 아니라 이벤트(record +10s)가 갱신을
// 끈다. staleTime 5m + focus refetch는 멀티 디바이스 드리프트만 커버하는 안전망.
const UNIVERSE_STALE_MS = 5 * 60_000
// 30m 보관: 랜딩↔우주 라우트 왕복에서 캐시로 즉시 표시(잠든 별·일기 탐색은 spec 31부터
// 우주 셸 위 오버레이라 캔버스가 언마운트되지 않는다 — 그 동선엔 왕복 자체가 없다).
const UNIVERSE_GC_MS = 30 * 60_000

function buildUniverseQueryOptions() {
  // base 스프레드는 connect-query의 키 + protobuf-aware structuralSharing을 가져온다 —
  // 내용이 같은 refetch는 이전 data 참조를 유지해 applyUniverse 자체가 안 돈다(의도적 유지).
  const base = createQueryOptions(MemoryService.method.getUniverse, {}, { transport })
  return queryOptions({
    ...base,
    // 체험 모드: 백엔드 대신 더미 우주를 같은 쿼리 캐시 경로로 태운다(UI 분기 제거, 1.7).
    // 체험↔실서버 전환은 app이 캐시·스토어를 리셋한다(reset-universe-data) — 키가 모드를
    // 포함하지 않아도 출처가 섞이지 않는 이유.
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetUniverseResponse> =>
      isDemoMode()
        ? Promise.resolve(
            create(GetUniverseResponseSchema, { stars: demoStars(), synapses: demoSynapses() }),
          )
        : callUnaryMethod(transport, MemoryService.method.getUniverse, {}, { signal }),
    staleTime: UNIVERSE_STALE_MS,
    gcTime: UNIVERSE_GC_MS,
    refetchOnWindowFocus: true, // stale(>5m)일 때만 실제 발화
  })
}

// 옵션은 내용 불변(데모 분기는 queryFn 안에서 fetch 시점 평가) — 렌더마다 protobuf 키
// 재생성을 하지 않게 1회 만들어 재사용한다(R3F 페이지의 잦은 리렌더에서 GC 압력 제거).
let universeOptionsCache: ReturnType<typeof buildUniverseQueryOptions> | undefined

/** GetUniverse 쿼리 옵션 — key는 connect-query 생성(부분 키 invalidate와 호환). */
export function universeQueryOptions() {
  return (universeOptionsCache ??= buildUniverseQueryOptions())
}

/** GetUniverse 부분 키(transport·input 생략 → 모든 변형 매치) — invalidate 전용. 쿼리
 *  옵션과 같은 파일에 두어 키 파생이 바뀌면 함께 바뀌게 한다(분산 시 무효화가 조용히
 *  no-op이 되는 사고 방지). */
export function universeInvalidateKey() {
  return createConnectQueryKey({ schema: MemoryService.method.getUniverse, cardinality: 'finite' })
}

/** Query success → render stores, via MERGE (never wholesale replace — spec 16 1.4).
 *  The synapse `brightness` is the time-DECAY factor starBrightness(lastActivatedAt) —
 *  NOT the weight-folded value: visualIntensity already multiplies by weight at render
 *  (08/12), so a dormant link dims but never vanishes (constitution §2). */
export function applyUniverse(res: GetUniverseResponse): void {
  // 가상 시계(spec 19): 데모 시간 머신이 보낸 시간을 포함한 now로 밝기를 파생한다.
  const now = virtualNowMs()
  const memory = useMemoryStore.getState()
  const stars = mergeStars(
    memory.stars,
    res.stars.map((s, i) => mapStar(s, i)),
  )
  if (stars !== memory.stars) memory.setStars(stars)
  // "빈 우주를 확인했다" 마킹 — 신규 유저의 첫 일기 별이 탄생 연출을 받게 한다
  // (StarField는 이 플래그 없이는 첫 도착 배치를 '첫 로드 시드'로 보고 연출을 건너뛴다).
  if (stars.length === 0 && !memory.loadedEmpty) memory.setLoadedEmpty(true)

  // 요즘 상태(spec 25): 서버 ambient 요약이 있으면 그걸, 없으면(데모·구버전) 로드된 별에서
  // 7일 가중 종합으로 파생한다(1.9). 다중 광원의 색 분포는 어느 경우든 클라가 별에서 따로
  // 만든다(AmbientNebula의 ambientLights — 좌표·렌더 입력은 클라 권위, 원칙3).
  memory.setAmbient(
    res.ambient
      ? { hue: res.ambient.hue, sat: res.ambient.sat, arousal: res.ambient.arousal, valence: res.ambient.valence }
      : deriveAmbient(ambientStarsOf(stars), now),
  )

  const synapse = useSynapseStore.getState()
  const incoming = res.synapses.map((s) => {
    const lastActivatedAt = parseEpochMs(s.lastActivatedAt, now)
    return {
      ...toSynapseEdge(s),
      lastActivatedAt,
      brightness: starBrightness(lastActivatedAt, now),
    }
  })
  const edges = mergeEdges(synapse.edges, incoming, now)
  if (edges !== synapse.edges) synapse.setEdges(edges)
}

/** 시간 머신(spec 19) 직후, 현재 스토어의 별·엣지 밝기를 가상 now로 재파생한다.
 *  데이터(타임스탬프)는 그대로이고 "지금"만 움직였으므로 refetch는 no-op이다(structural
 *  sharing이 같은 내용을 같은 참조로 유지) — 대신 별 배열의 identity를 갱신해 StarField의
 *  rebuild 효과가 새 now로 밝기를 다시 굽게 하고, 엣지 brightness는 여기서 직접 재파생한다. */
export function refreshActivation(): void {
  const now = virtualNowMs()
  const memory = useMemoryStore.getState()
  if (memory.stars.length > 0) memory.setStars([...memory.stars])
  // 가상 시계가 흐르면 요즘 상태도 식는다 — 데모 시간 머신 경로 전용(refreshActivation의
  // 유일 호출처)이라 서버 요약을 덮어쓰지 않는다. 별에서 새 now로 다시 종합해 배경이 그만큼
  // 잔잔해지고(arousal↓) 색이 옮겨간다(1.11).
  if (memory.stars.length > 0) memory.setAmbient(deriveAmbient(ambientStarsOf(memory.stars), now))
  const synapse = useSynapseStore.getState()
  if (synapse.edges.length > 0) {
    synapse.setEdges(
      synapse.edges.map((e) =>
        e.lastActivatedAt != null ? { ...e, brightness: starBrightness(e.lastActivatedAt, now) } : e,
      ),
    )
  }
}

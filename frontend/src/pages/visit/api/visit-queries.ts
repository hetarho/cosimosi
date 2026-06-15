// 공개 방문 데이터 계층(spec 35): 무인증 VisitService.GetSharedUniverse 쿼리 + 공개 스냅샷을
// 우주 store(별·시냅스·요즘 하늘색)에 반영하는 매핑. 인증 transport를 쓰지 않는 *전용 공개 전송*을
// 만들어 방문 표면이 토큰을 절대 싣지 않게 한다(공개 표면 격리 — 헌법). no three/React/DOM 매핑(헌법4).
import { queryOptions } from '@tanstack/react-query'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { VisitService, type GetSharedUniverseResponse } from '@/shared/api'
import {
  deriveAmbient,
  moodFromProto,
  seedFromId,
  useMemoryStore,
  type StarNode,
} from '@/entities/memory'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse'

// 하루 = ms. 공개 별은 *일 단위*로만 시각을 받으므로(행동 핑거프린팅 방지) day → ms로 환원해
// 밝기/반지름 파생에 쓴다(정확 시각은 애초에 응답에 없다).
const DAY_MS = 86_400_000

// Dev → Vite 프록시('/api'); prod/preview → VITE_API_URL. 인증 인터셉터 없음(공개 전송) — 방문은
// 순수 읽기라 토큰이 불필요하고, 표면 격리상 절대 싣지 않는다. ⚠️ useHttpGet은 쓰지 않는다(=POST):
// GET이면 브라우저/CDN HTTP 캐시가 응답을 보관해, 소유자가 끄거나 회전한 뒤에도 옛 슬러그가
// 캐시에서 그려질 수 있다(즉시 무효화 위반, codex HIGH). POST는 캐시되지 않아 매번 서버가 권위.
const baseUrl = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL
const publicTransport = createConnectTransport({ baseUrl })
const visitClient = createClient(VisitService, publicTransport)

/** GetSharedUniverse 쿼리 옵션(slug별). 즉시 무효화가 프라이버시 계약이므로(끄기·회전 시 옛 URL은
 *  즉시 NotFound) **캐시하지 않는다**: staleTime 0 + refetchOnMount 'always' + gcTime 0이면 매
 *  진입이 서버에 재검증한다. NotFound는 재시도하지 않는다(꺼짐/없음/회전은 영구 상태). */
export function sharedUniverseQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['shared-universe', slug],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetSharedUniverseResponse> =>
      visitClient.getSharedUniverse({ slug }, { signal }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
}

/** 공개 스냅샷 → 우주 store(별·시냅스·요즘 하늘색)에 *전체 교체*로 반영한다(병합 아님 — 방문은
 *  소유자 우주의 스냅샷 1장이라 누적이 없다). SharedStar엔 id가 없으므로 응답 인덱스로 합성 id
 *  (`shared-N`)를 부여하고, 시냅스는 인덱스 쌍을 같은 합성 id로 잇는다. 요즘 하늘색(spec 25)은 서버가
 *  보내지 않으므로 로드된 별에서 클라가 파생한다(deriveAmbient — 데모/폴백과 같은 경로). 소유자의
 *  시각 설정(appearance)은 페이지가 별도로 appearance store에 적용한다(방문자 설정 보존을 위해). */
export function applySharedUniverse(res: GetSharedUniverseResponse): void {
  const now = Date.now() // 방문 페이지는 데모가 아니다 — 실제 현재 시각으로 밝기 파생
  const stars: StarNode[] = res.stars.map((s, i) => {
    const id = `shared-${i}`
    return {
      id,
      index: i,
      memory: {
        id,
        mood: moodFromProto(s.mood),
        intensity: s.intensity,
        // valence/relevance/조각·재성형 메타는 공개 스냅샷에 없다 — 중립값(풍경만 공개).
        valence: 0,
        relevance: 0,
        lastRecalledAt: Number(s.lastRecalledDay) * DAY_MS,
        recordId: '', // 원본 일기 그룹 키 없음(방문은 일기 접근 불가)
        fragmentIndex: 0,
        seed: seedFromId(id),
        brightnessOffset: 0,
        hueShift: 0,
        formSeedDelta: 0,
        version: 0,
        // 공개 우주(35)엔 공명을 절대 노출하지 않는다(제3자에게 관계 비노출, spec 36 비목표).
        resonant: false,
      },
    }
  })

  const memory = useMemoryStore.getState()
  memory.setStars(stars)
  // 스냅샷은 완결된 집합 — 빈 우주면 캔버스가 즉시 드러나게 true, 비어있지 않으면 명시적으로 false로
  // (이전 인증 세션/직전 슬러그의 loadedEmpty가 새 우주의 birth 연출을 잘못 트리거하지 않게 — codex MED).
  memory.setLoadedEmpty(stars.length === 0)
  memory.setAmbient(
    deriveAmbient(
      stars.map((s) => ({
        mood: s.memory.mood,
        intensity: s.memory.intensity,
        valence: s.memory.valence,
        lastRecalledAt: s.memory.lastRecalledAt,
      })),
      now,
    ),
  )

  const synapse = useSynapseStore.getState()
  const n = stars.length
  synapse.setEdges(
    res.synapses
      // 무인증 공개 표면이라 끝점 인덱스가 범위 밖이거나 self-loop인 엣지는 방어적으로 버린다
      // (서버는 유효 쌍만 보내지만, 없는 별을 가리키는 엣지가 렌더러에 닿지 않게 한다).
      .filter((s) => s.a >= 0 && s.b >= 0 && s.a < n && s.b < n && s.a !== s.b)
      .map((s) => {
        // 인덱스 쌍을 합성 id로 — a<b 정규화(렌더러/포스심은 무방향이라 일관성만 있으면 된다).
        const [lo, hi] = s.a <= s.b ? [s.a, s.b] : [s.b, s.a]
        return toSynapseEdge({
          aId: `shared-${lo}`,
          bId: `shared-${hi}`,
          weight: s.weight,
          linkType: 'semantic',
          lastActivatedAt: '', // 활성 시각은 공개하지 않는다 → 시간 감쇠 없이 weight로만 굵기 변조
          coActivationCount: 0,
        })
      }),
  )
}

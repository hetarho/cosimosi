import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { Code, ConnectError } from '@connectrpc/connect'
import { create } from '@bufbuild/protobuf'
import { errorMessage } from '@/shared/lib'
import { virtualNowMs } from '@/shared/lib/demo'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { primaryButtonCls } from '@/shared/ui'
import { GetSettingsResponseSchema, supabase } from '@/shared/api'
import {
  UniverseCanvas,
  UniverseGrain,
  UniverseOverlay,
  OverlayComparePanel,
  navigationActor,
  type Bridge,
} from '@/widgets/universe-canvas'
import {
  focusActor,
  fragmentTextQueryKey,
  mapStar,
  moodFromProto,
  parseEpochMs,
  recordsQueryOptions,
  starBrightness,
  universeQueryOptions,
  useMemoryStore,
  type StarNode,
} from '@/entities/memory'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse'
import { normalizeStarLook } from '@/entities/star'
import { applySettings, useAppearance } from '@/entities/appearance'
import {
  applySharedUniverse,
  mapSharedUniverse,
  resonanceBridgesQueryOptions,
  sharedUniverseQueryOptions,
} from '../api/visit-queries'

/** 공개 우주 영역 풀오버레이 카드 chrome — NotFound·로드 실패·렌더러 불가가 공유. */
function VisitCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="flex w-80 max-w-[85vw] flex-col items-center gap-3 rounded-xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur">
        {children}
      </div>
    </div>
  )
}

/** 비로그인 방문자가 자기 우주를 만들도록 이끄는 CTA(2.3) — 마케팅 랜딩으로(루트 `/`는 보호 우주). */
function CreateUniverseCTA() {
  return (
    <Link to="/landing" className={primaryButtonCls}>
      나의 우주 만들기
    </Link>
  )
}

/** 캔버스 전용 폴백(17 재사용): 렌더러 불가 기기 안내 / 일반 크래시 재시도. HUD(헤더·CTA)는
 *  바운더리 밖이라 살아 있다. */
function CanvasErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const unavailable = error instanceof RendererUnavailableError
  return (
    <VisitCard>
      {unavailable ? (
        <p className="text-sm text-white/85">이 브라우저/기기에서는 우주를 그릴 수 없어요.</p>
      ) : (
        <>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(error)}</p>
          <button type="button" onClick={resetError} className={primaryButtonCls}>
            다시 시도
          </button>
        </>
      )}
    </VisitCard>
  )
}

/** 공개 방문 페이지(spec 35): SessionGate 밖의 무인증 라우트 `/u/$slug`. 우주 캔버스를 읽기 전용으로
 *  재사용한다 — 기록 폼·회상 패널·시뮬 패널 없음, 별을 눌러도 어떤 텍스트도 뜨지 않는다(바라보기만).
 *  소유자의 시각 설정·풍경이 적용되고, 하단에 비로그인 CTA가 있다. */
export function VisitPage() {
  const { slug } = useParams({ from: '/u/$slug' })
  const query = useQuery(sharedUniverseQueryOptions(slug))
  const { data } = query
  const queryClient = useQueryClient()

  // 겹쳐보기(spec 37) — 로그인 사용자 한정 토글. 비로그인엔 토글 자체를 노출하지 않는다(1.2).
  const [overlayOn, setOverlayOn] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(({ data: s }) => {
      if (alive) setLoggedIn(!!s.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session))
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 내 우주(겹칠 때만 로드) — GetUniverse(인증). 스토어엔 싣지 않는다(스토어는 친구 우주를 들고 있다);
  // 겹쳐보기는 두 우주를 PROPS로 받는다. 다리(GetResonanceBridges)는 당사자만 비어있지 않다(2.2).
  const myUniverse = useQuery({ ...universeQueryOptions(), enabled: overlayOn && loggedIn })
  const bridgesQuery = useQuery(resonanceBridgesQueryOptions(slug, overlayOn && loggedIn))
  // 내 일기 목록(읽기 전용 ListRecords, NO_SIDE_EFFECTS) — 비교 패널의 "내 별" 텍스트 폴백 소스다.
  // overlay는 쓰기 금지(3.1)라 RecallMemory(재점화)를 못 부르므로, 회상 캐시가 비어 있을 때 이 발췌로
  // 내 쪽 텍스트를 보인다(친구 쪽은 콘텐츠 제로라 텍스트가 절대 없다 — 비대칭은 설계, 2.3).
  const myRecords = useQuery({ ...recordsQueryOptions(), enabled: overlayOn && loggedIn })

  // 공유 store(memory·synapse·appearance·focus)는 인증 우주와 한 싱글턴이다. 방문자의 appearance를
  // *첫 렌더에 단 한 번* 캡처한다(lazy init은 effect/소유자 적용보다 먼저 실행되므로 항상 순수한
  // 방문자 값이다 — 소유자 색이 섞인 뒤 다시 캡처될 위험이 구조적으로 없다).
  const [visitorAppearance] = useState(() => {
    const ap = useAppearance.getState()
    return {
      theme: ap.theme,
      object: ap.object,
      selfObject: ap.selfObject,
      synapseStyle: ap.synapseStyle,
      emotionColors: ap.emotionColors,
    }
  })

  // 친구 우주(겹쳐보기용) — 스냅샷을 PURE 매핑(스토어 미경유). 친구 시각 설정은 data.appearance에서.
  const theirSide = useMemo(() => {
    if (!data) return null
    const { stars, edges } = mapSharedUniverse(data)
    const appearance = data.appearance
    // 소유자 별 스킨(합성 또는 레거시 단일 id) → 유효 합성으로 정규화(미설정이면 기본, spec 52).
    const object = appearance?.starObject ? normalizeStarLook(appearance.starObject) : undefined
    const emotionColors: Record<string, string> = {}
    for (const c of appearance?.emotionColors ?? []) emotionColors[moodFromProto(c.mood)] = c.color
    return { stars, edges, object, emotionColors }
  }, [data])

  // 내 우주(겹쳐보기용) — GetUniverse 응답을 PURE 매핑(merge/store 경유 없음). 내 시각 설정은 방문자 값.
  const mySide = useMemo(() => {
    const d = myUniverse.data
    if (!d) return null
    // 별 밝기와 같은 시각 기준을 쓴다(mapStar도 virtualNowMs를 읽는다). 방문은 비데모라 = Date.now().
    const now = virtualNowMs()
    const stars: StarNode[] = d.stars.map((s, i) => mapStar(s, i))
    // 엣지 밝기는 applyUniverse와 같게 활성 시각에서 시간 감쇠로 파생한다 — toSynapseEdge의 brightness=1
    // 기본값을 그대로 쓰면 내 우주에선 흐릿한 휴면 링크가 겹침 뷰에선 풀밝기로 떠 같은 우주가 달라 보인다.
    const edges = d.synapses.map((s) => {
      const lastActivatedAt = parseEpochMs(s.lastActivatedAt, now)
      return { ...toSynapseEdge(s), lastActivatedAt, brightness: starBrightness(lastActivatedAt, now) }
    })
    return { stars, edges, object: visitorAppearance.object, emotionColors: visitorAppearance.emotionColors }
  }, [myUniverse.data, visitorAppearance])

  // 서버는 상대 별을 *공개 스냅샷 인덱스*로 준다(콘텐츠 제로 — id 비노출). 친구 우주의 StarNode id는
  // mapSharedUniverse 규약대로 `shared-N`이므로 여기서 인덱스를 그 id로 환원해 다리에 넘긴다(스냅샷
  // 인덱스 규약은 이 페이지에만 — 다리 컴포넌트는 순수 두-id 쌍).
  // ⚠️ 스냅샷-인덱스 정합: their_star_index는 *같은 시점의* GetSharedUniverse 배열 인덱스를 가정한다.
  // 두 RPC는 따로 페치되므로(이론상 그 찰나에 소유자가 별을 추가하면 인덱스가 밀릴 수 있다), 친구 우주
  // 별 수 범위 밖 인덱스는 버린다 — 끝점 없는(분리된) 다리가 그려지지 않게 한다(3.3). 범위 안이면 같은
  // `shared-N` 규약으로 환원해 다리에 넘긴다(다리 컴포넌트는 순수 두-id 쌍).
  const bridges: Bridge[] = useMemo(() => {
    const count = theirSide?.stars.length ?? 0
    return (bridgesQuery.data?.bridges ?? [])
      .filter((b) => b.theirStarIndex >= 0 && b.theirStarIndex < count)
      .map((b) => ({ myId: b.myMemoryId, theirId: `shared-${b.theirStarIndex}` }))
  }, [bridgesQuery.data, theirSide])

  // 내 record_id → 일기 발췌(읽기 전용) — 비교 패널 "내 별" 텍스트 폴백. mapStar가 별의 recordId를
  // 보존하므로 별 → record_id → 발췌로 잇는다(겹침이 첫 화면이라 회상 캐시가 비어도 내 글이 보인다).
  const myRecordExcerpt = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of myRecords.data?.records ?? []) m.set(r.recordId, r.bodyExcerpt)
    return m
  }, [myRecords.data])

  const overlayReady = overlayOn && mySide != null && theirSide != null
  // 겹쳐보기 진입/이탈을 navigation 머신에 반영(overlay 상태 = 쓰기 게이트·전용 카메라). 양쪽 우주가
  // 준비됐을 때 진입하고, 끄거나 떠날 때 nebula로 복귀 + 쌍 선택 해제.
  useEffect(() => {
    if (overlayReady) {
      navigationActor.send({ type: 'ENTER_OVERLAY' })
      return () => {
        navigationActor.send({ type: 'EXIT_OVERLAY' })
        focusActor.send({ type: 'DISMISS' })
      }
    }
  }, [overlayReady])

  // 보는 우주(slug)가 바뀌면 렌더 store를 비운다(직전 소유자의 별·강조가 남지 않게). loadedEmpty도
  // 초기화해 빈/비어있지 않은 우주 전환 시 birth 연출이 잘못 트리거되지 않게 한다. (겹쳐보기 토글은
  // 그대로 둔다 — theirSide/다리가 새 slug로 재파생되고, 준비 전까지 단일 뷰로 폴백한다.)
  useEffect(() => {
    focusActor.send({ type: 'DISMISS' })
    const m = useMemoryStore.getState()
    m.setStars([])
    m.setLoadedEmpty(false)
    useSynapseStore.getState().setEdges([])
  }, [slug])

  // 공개 표면을 떠날 때(언마운트): store를 비우고 방문자 자신의 appearance를 복원한다(소유자 풍경이
  // 방문자 기기 localStorage에 눌러앉지 않게). 캡처는 첫 렌더 1회뿐이라 복원값은 언제나 순수 방문자 값.
  useEffect(() => {
    return () => {
      focusActor.send({ type: 'DISMISS' })
      const m = useMemoryStore.getState()
      m.setStars([])
      m.setLoadedEmpty(false)
      useSynapseStore.getState().setEdges([])
      const a = useAppearance.getState()
      a.setTheme(visitorAppearance.theme)
      a.setObject(visitorAppearance.object)
      // 나·시냅스 두 축도 방문자 값으로 복원 — 소유자 선택이 방문자 store·localStorage에 새지 않게(T048).
      a.setSelfObject(visitorAppearance.selfObject)
      a.setSynapseStyle(visitorAppearance.synapseStyle)
      a.applyServerSettings({
        theme: undefined,
        object: undefined,
        selfObject: undefined,
        synapseStyle: undefined,
        emotionColors: visitorAppearance.emotionColors,
      })
    }
  }, [visitorAppearance])

  // 스냅샷 도착 → 별·시냅스·하늘색 반영 + 소유자 시각 설정 적용(방문자 색 오버라이드는 먼저 비워
  // 소유자 것이 온전히 보이게 한다 — 언마운트 시 방문자 값을 복원한다).
  useEffect(() => {
    if (!data) return
    applySharedUniverse(data)
    useAppearance.getState().resetServerSettings()
    applySettings(create(GetSettingsResponseSchema, { settings: data.appearance }))
  }, [data])

  // 없음/꺼짐/회전된 슬러그는 서버가 *균일* NotFound로 응답한다(존재 비노출) — 캔버스 없이 안내만.
  const notFound =
    query.isError && ConnectError.from(query.error).code === Code.NotFound

  const title = data ? (data.displayName ? `${data.displayName}의 우주` : '어느 우주') : ''

  if (notFound) {
    return (
      <div className="fixed inset-0 bg-black">
        <VisitCard>
          <p className="text-base text-white/90">우주를 찾을 수 없어요.</p>
          <p className="text-xs text-white/45">
            링크가 만료됐거나 공개가 꺼졌을 수 있어요. 직접 우주를 만들어 보세요.
          </p>
          <CreateUniverseCTA />
        </VisitCard>
      </div>
    )
  }

  return (
    <div className="universe-page fixed inset-0" data-lenis-prevent>
      <Sentry.ErrorBoundary fallback={CanvasErrorFallback}>
        {/* 겹쳐보기(spec 37): 두 우주가 준비되면 단일 우주 캔버스 대신 오버레이를 마운트한다(두 WebGPU
            컨텍스트 공존 방지 — 조건부 렌더로 하나만). 준비 전엔 단일 친구 우주를 그대로 보여준다. */}
        {overlayReady && mySide && theirSide ? (
          <UniverseOverlay mine={mySide} theirs={theirSide} bridges={bridges} />
        ) : (
          <UniverseCanvas />
        )}
      </Sentry.ErrorBoundary>
      <UniverseGrain />

      {/* 겹쳐보기 비교 패널(spec 37) — 공명 다리를 누르면 두 기억을 나란히. 상대 쪽은 시각 정보만. */}
      {overlayReady && mySide && theirSide && (
        <OverlayComparePanel
          myStars={mySide.stars}
          theirStars={theirSide.stars}
          myEmotionColors={mySide.emotionColors}
          theirEmotionColors={theirSide.emotionColors}
          // 내 별 텍스트(겹침 뷰는 쓰기 RPC 금지 3.1 — RecallMemory 안 부른다): 먼저 *읽기 전용* 회상
          // 캐시(이번 세션에 내 우주에서 회상해 시드됐으면 조각 텍스트), 없으면 내 일기 목록(읽기 전용
          // ListRecords)의 원본 발췌로 폴백한다. 둘 다 쓰기 없이 내 쪽 텍스트를 채운다(친구 쪽은 비노출).
          resolveMyText={(id) => {
            const cached = queryClient.getQueryData(fragmentTextQueryKey(id))
            if (typeof cached === 'string' && cached.trim() !== '') return cached
            const recId = mySide?.stars.find((s) => s.id === id)?.memory.recordId
            return recId ? myRecordExcerpt.get(recId) : undefined
          }}
        />
      )}

      {/* 겹쳐보기 토글(로그인 한정, 1.2). 비로그인엔 노출하지 않는다. */}
      {loggedIn && data && (
        <div className="absolute right-[calc(1rem+env(safe-area-inset-right))] top-[calc(1rem+env(safe-area-inset-top))] z-30">
          <button
            type="button"
            onClick={() => setOverlayOn((v) => !v)}
            className="rounded-full border border-white/15 bg-black/55 px-4 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:bg-black/70"
          >
            {overlayOn ? '겹치기 끄기' : '내 우주와 겹쳐보기'}
          </button>
        </div>
      )}

      {/* 헤더 — 소유자 표시명("○○의 우주" / 익명이면 "어느 우주"). 읽기 전용 안내 한 줄. */}
      {data && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-1 px-4 text-center">
          <h1 className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur">
            {title}
          </h1>
          <p className="text-[11px] text-white/40">
            {overlayOn
              ? '내 우주와 겹쳐 보는 중 — 공명한 별이 빛의 다리로 이어져요'
              : '풍경만 공개된 우주예요 — 일기 내용은 비공개입니다'}
          </p>
        </div>
      )}

      {/* 겹쳐보기 로딩 — 내 우주/다리를 가져오는 동안. */}
      {overlayOn && !overlayReady && !notFound && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70 backdrop-blur">
            두 우주를 겹치는 중…
          </p>
        </div>
      )}

      {/* 하단 비로그인 CTA(2.3) — 나의 우주 만들기. */}
      <div className="absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
        <CreateUniverseCTA />
      </div>

      {/* 로딩 — 응답 전 빈 캔버스를 "별 없음"으로 오인시키지 않는다. */}
      {query.isPending && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70 backdrop-blur">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      {/* NotFound가 아닌 로드 실패 — 카드 + 재시도. */}
      {query.isError && !notFound && (
        <VisitCard>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(query.error)}</p>
          <button type="button" onClick={() => void query.refetch()} className={primaryButtonCls}>
            다시 시도
          </button>
        </VisitCard>
      )}
    </div>
  )
}

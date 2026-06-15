import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { Code, ConnectError } from '@connectrpc/connect'
import { create } from '@bufbuild/protobuf'
import { errorMessage } from '@/shared/lib'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { primaryButtonCls } from '@/shared/ui'
import { GetSettingsResponseSchema } from '@/shared/api'
import { UniverseCanvas, UniverseGrain } from '@/widgets/universe-canvas'
import { focusActor, useMemoryStore } from '@/entities/memory'
import { useSynapseStore } from '@/entities/synapse'
import { applySettings, useAppearance } from '@/entities/appearance'
import { applySharedUniverse, sharedUniverseQueryOptions } from '../api/visit-queries'

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

/** 비로그인 방문자가 자기 우주를 만들도록 이끄는 CTA(2.3) — 랜딩/사인인으로. */
function CreateUniverseCTA() {
  return (
    <Link to="/" className={primaryButtonCls}>
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

  // 공유 store(memory·synapse·appearance·focus)는 인증 우주와 한 싱글턴이다. 방문자의 appearance를
  // *첫 렌더에 단 한 번* 캡처한다(lazy init은 effect/소유자 적용보다 먼저 실행되므로 항상 순수한
  // 방문자 값이다 — 소유자 색이 섞인 뒤 다시 캡처될 위험이 구조적으로 없다).
  const [visitorAppearance] = useState(() => {
    const ap = useAppearance.getState()
    return { theme: ap.theme, object: ap.object, emotionColors: ap.emotionColors }
  })

  // 보는 우주(slug)가 바뀌면 렌더 store를 비운다(직전 소유자의 별·강조가 남지 않게). loadedEmpty도
  // 초기화해 빈/비어있지 않은 우주 전환 시 birth 연출이 잘못 트리거되지 않게 한다.
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
      a.applyServerSettings({
        theme: undefined,
        object: undefined,
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
        <UniverseCanvas />
      </Sentry.ErrorBoundary>
      <UniverseGrain />

      {/* 헤더 — 소유자 표시명("○○의 우주" / 익명이면 "어느 우주"). 읽기 전용 안내 한 줄. */}
      {data && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-1 px-4 text-center">
          <h1 className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur">
            {title}
          </h1>
          <p className="text-[11px] text-white/40">풍경만 공개된 우주예요 — 일기 내용은 비공개입니다</p>
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

// Recall panel (spec 11, cached by 16; change 35) — a 2D HUD outside the R3F canvas
// (Architecture §3.1). Clicking a star opens this panel and reads its content READ-ONLY via
// PeekMemory — NO side effect (no re-ignition/reshape/co-recall): browsing the universe must
// not re-shape every star it touches. But the body stays VISUALLY VEILED (a blur over the text;
// portrait + meta show) until the deliberate "이 별 자세히 보고 회상하기" button recalls it — you
// must choose to remember to read it. That button is the ONLY path to RecallMemory's side effects
// (re-ignition + PE-gated reshape + co-recall pair), gated by a cooldown (recall_cooldown_ms,
// BE-authoritative). A star still within its cooldown (just recalled) opens already un-veiled.
// The Record is immutable → cached forever (['record', id]): a re-open shows the body from cache.
import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/react'
import { useSelector } from '@xstate/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Record as RecordMsg } from '@/shared/api'
import { capture, EVENTS } from '@/shared/lib'
import { isDemoMode, virtualNowMs } from '@/shared/lib/demo'
import {
  dormantInvalidateKey,
  focusActor,
  fragmentTextQueryKey,
  isDormant,
  moodFromProto,
  recordQueryKey,
  selectFocusedStarId,
  universeInvalidateKey,
  useMemoryStore,
} from '@/entities/memory'
import { parseStarLook } from '@/entities/star'
import { useAppearance } from '@/entities/appearance'
import { abstractionGauge, abstractionLabel, moodLabel, resolveMoodRgb, rgbToHex } from '@/shared/config'
import { peekMemory, recallMemory } from '../api/recall'
import { resonanceInfoQueryOptions } from '../api/resonance'
import { recallCooldownRemainingMs } from '../model/cooldown'
import { recallFlushActor } from '../model/recall-flush.machine'
import { NeighborNav } from './NeighborNav'
import { StarPortrait3D } from './StarPortrait3D'

type Phase = 'loading' | 'shown' | 'error'

/** Inner panel for one selected star. Keyed by memoryId so a new selection remounts it
 *  fresh (state resets without a setState-in-effect). onOpenEvolution / onSeeDiaryStars are
 *  wired by the page (FSD: recall doesn't import the evolution/wayfinding features — the page
 *  composes them). */
function RecallView({
  memoryId,
  onOpenEvolution,
  onSeeDiaryStars,
  onSendStar,
}: {
  memoryId: string
  onOpenEvolution?: (memoryId: string) => void
  onSeeDiaryStars?: (recordId: string) => void
  onSendStar?: (memoryId: string) => void
}) {
  const queryClient = useQueryClient()
  // 이 별이 가리키는 원본 일기 id(spec 28) — "이 일기의 다른 별들 보기"의 그룹 키. 별이 사라지지
  // 않는 한(헌법2) 안정적이라 selector가 값으로 비교해 불필요한 리렌더는 없다.
  const recordId = useMemoryStore(
    (s) => s.stars.find((st) => st.id === memoryId)?.memory.recordId ?? '',
  )
  // 공명 여부(spec 36) — 우주 스냅샷의 resonant 플래그. true일 때만 상대 정보를 조회한다(비공명 별엔
  // RPC 미발사). 데모엔 서버가 없어 조회 자체를 끈다.
  const resonant = useMemoryStore(
    (s) => s.stars.find((st) => st.id === memoryId)?.memory.resonant ?? false,
  )
  // 상단 별 포트레이트(change 32) 입력 — 그 별의 정체성을 우주와 같은 경로로 재현한다. StarNode는 변형 전엔
  // 참조가 안정해 불필요한 리렌더가 없다(merge가 무변경 노드 객체를 보존, §store). 변형되면 새 식별자로 다시 그린다.
  const star = useMemoryStore((s) => s.stars.find((st) => st.id === memoryId))
  const object = useAppearance((s) => s.object)
  const starFormByEmotion = useAppearance((s) => s.starFormByEmotion)
  const emotionColors = useAppearance((s) => s.emotionColors)
  // 룩 = 그 별 mood의 감정 오버라이드(없으면 전역 기본), 우주 StarField와 동일 규칙(change 30). 색 = 감정색.
  const portrait = star
    ? {
        look: parseStarLook(starFormByEmotion?.[star.memory.mood] ?? object),
        colorHex: rgbToHex(resolveMoodRgb(star.memory.mood, emotionColors)),
        stage: star.memory.abstractionStage,
        seed: star.memory.seed,
        shapeSeed: star.memory.shapeSeed,
      }
    : null
  const resonanceQuery = useQuery({
    ...resonanceInfoQueryOptions(memoryId),
    enabled: resonant && !isDemoMode(),
  })
  const resonance = resonanceQuery.data
  // 재열람 = 캐시에서 즉시 본문(스피너 없음, 1.5). 원본은 불변(헌법 §1)이라 안전하다.
  const [record, setRecord] = useState<RecordMsg | null>(
    () => queryClient.getQueryData<RecordMsg>(recordQueryKey(memoryId)) ?? null,
  )
  // 그 별의 조각 텍스트(spec 28) — 원본과 같은 불변·영구 캐시에서 즉시(재열람 무스피너).
  const [fragmentText, setFragmentText] = useState<string>(
    () => queryClient.getQueryData<string>(fragmentTextQueryKey(memoryId)) ?? '',
  )
  // 재공고화 AI 내용 변형(spec 54)의 현재 파생 텍스트 — 추상화 단계 ≥2 별이 다시 빚어졌을 때만 비어있지
  // 않다. peek/회상 응답에서 받는다(캐시 안 함 — 서버가 흐릴 수 있어 항상 최신을 본다). ""면 조각/원본 폴백.
  const [derivedText, setDerivedText] = useState<string>('')
  // 기본은 조각만; 사용자가 "원본 일기 전체 보기"를 누르면 불변 원본 전체로 펼친다.
  const [showFull, setShowFull] = useState(false)
  const [phase, setPhase] = useState<Phase>(record ? 'shown' : 'loading')
  // 회상 진행 중(버튼 중복 발화 방지) + 남은 재회상 쿨다운(change 35). 초기값은 store의 회상 횟수·마지막
  // 회상 시각으로 클라가 계산(보조 — 진짜 강제는 BE). 데모는 가상 시계 기준. 회상 응답이 서버 권위로 덮어쓴다.
  const [recalling, setRecalling] = useState(false)
  // 회상 응답이 도착하기 전 패널이 닫히면(언마운트) 늦은 콜백이 빈 캐시를 오염시키지 않게 막는다.
  const cancelledRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])
  // 최초 1회만(lazy initializer — 렌더 중 Date.now 호출 회피) store의 회상 횟수·마지막 회상 시각으로 잔여
  // 쿨다운을 파생한다. 별 전환=키 기반 remount라 마운트당 한 번이면 충분(서버 응답이 이후 권위로 덮어쓴다).
  const [initialCooldownMs] = useState<number>(() =>
    star
      ? recallCooldownRemainingMs(
          star.memory.recallCount,
          star.memory.lastRecalledAt,
          isDemoMode() ? virtualNowMs() : Date.now(),
        )
      : 0,
  )
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(initialCooldownMs)
  // 본문 공개 여부(change 35): 별 클릭만으론 본문이 블러로 가려지고, 회상해야 또렷해진다(포트레이트·메타는
  // 항상 보임). 쿨다운이 남아 있는 별 = 방금 떠올린 기억이라 열자마자 또렷; 그 외(처음/오래 안 본 별)는
  // 가려진 채 시작해 회상 버튼이 걷어낸다. cooldown 경과로 또렷함이 사라진 뒤 다시 열면 또 가려진다(리마운트).
  const [revealed, setRevealed] = useState<boolean>(initialCooldownMs > 0)

  // 패널이 열리면 PeekMemory로 내용을 **즉시 읽기전용** 표시한다 — 부작용 없음(재점화/재성형/공동회상 안 함,
  // change 35). 캐시(불변 원본)가 있으면 본문을 바로 보이고, peek로 최신 derived_text를 채운다.
  useEffect(() => {
    let cancelled = false
    // 초기 phase는 캐시 여부로 이미 'shown'/'loading'으로 정해진다(별 전환=키 기반 remount). 여기선 peek
    // 결과만 반영한다 — 로딩 표시를 위한 동기 setState는 두지 않는다(효과 내 동기 setState 금지).
    const hasCached = queryClient.getQueryData(recordQueryKey(memoryId)) != null
    peekMemory(memoryId)
      .then((r) => {
        // cancelled 가드가 캐시 쓰기보다 먼저다: 로그아웃·출처 리셋(queryClient.clear) 뒤에 늦게
        // 도착한 응답이 이전 사용자의 기록을 빈 캐시에 재주입하면 안 된다(언마운트 = cancelled).
        if (cancelled) return
        if (r) {
          // 영구 시드(staleTime ∞ — app/query-client의 record 기본값): 다음 열람은 캐시로.
          queryClient.setQueryData(recordQueryKey(memoryId), r.record)
          queryClient.setQueryData(fragmentTextQueryKey(memoryId), r.fragmentText)
          setRecord(r.record)
          setFragmentText(r.fragmentText)
          setDerivedText(r.derivedText) // 54: 흐려진 현재 내용(없으면 ""→폴백)
          setPhase('shown')
        } else if (!hasCached) {
          setPhase('error')
        }
      })
      .catch((e: unknown) => {
        Sentry.captureException(e)
        if (!cancelled && !hasCached) setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [memoryId, queryClient])

  // "이 별 자세히 보고 회상하기"(change 35) — 의도적 회상. RecallMemory(부작용)를 발화하고, 성사 시
  // 내용·별을 갱신하고 우주를 무효화한다. 쿨다운에 막히면(서버 권위) 부작용 없이 잔여만 받아 버튼을 잠근다.
  const onRecall = () => {
    if (recalling || cooldownRemainingMs > 0) return
    setRecalling(true)
    recallMemory(memoryId)
      .then((r) => {
        if (cancelledRef.current || !r) {
          setRecalling(false)
          return
        }
        // 응답 내용(불변 원본·조각·흐려진 현재)을 항상 반영한다 — 성사든 쿨다운에 막혔든 같은 읽기전용
        // 내용을 싣고 오므로, 패널이 비어 있던(peek 실패) 경우에도 본문이 채워진다.
        queryClient.setQueryData(recordQueryKey(memoryId), r.record)
        queryClient.setQueryData(fragmentTextQueryKey(memoryId), r.fragmentText)
        setRecord(r.record)
        setFragmentText(r.fragmentText)
        setDerivedText(r.derivedText)
        setPhase('shown')
        // 회상 성사든 쿨다운에 막혔든(=방금 떠올린 기억) 본문을 또렷이 공개한다 — 블러를 걷는다(change 35).
        setRevealed(true)
        if (r.recalled) {
          // 공동 회상 쌍 누적은 이제 **버튼 회상** 시점에 발생한다(직전 회상 별과 페어 강화, change 35).
          recallFlushActor.send({ type: 'RECORD_VIEW', id: memoryId })
          // recall_open(18) — 회상 발화 시점의 활성도로 잠든 별 재점화 여부를 판단(우주 refetch 전 store 기준).
          const cur = useMemoryStore.getState().stars.find((s) => s.id === memoryId)
          capture(EVENTS.recallOpen, {
            is_dormant: cur ? isDormant(cur.memory.lastRecalledAt, virtualNowMs()) : false,
          })
          // 회상된 별은 잠에서 깸 → 잠든 별 목록 무효화(1.6).
          void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
          // 회상 재점화/재성형은 별 레이어를 바꾸므로 우주 쿼리를 즉시 무효화한다.
          // 데모는 demoMarkRecalled, 프로덕션은 TouchRecall/reconsolidate 결과를 refetch로 받는다.
          void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
        }
        // 서버 권위 쿨다운(성사면 방금 시작된 전체 쿨다운, 막혔으면 잔여) — 버튼 잠금/안내의 출처.
        setCooldownRemainingMs(r.cooldownRemainingMs)
        setRecalling(false)
      })
      .catch((e: unknown) => {
        Sentry.captureException(e)
        if (!cancelledRef.current) setRecalling(false)
      })
  }

  // 쿨다운이 흐르는 동안 패널을 열어 둔 채 임계가 지나면 버튼을 다시 켠다(프로덕션 실시계 기준). 데모는
  // 가상 시계(배속·빨리감기)라 실시간 타이머로 못 맞춘다 — 별 재선택/리마운트가 store에서 다시 계산한다.
  useEffect(() => {
    if (cooldownRemainingMs <= 0 || isDemoMode()) return
    const t = setTimeout(() => setCooldownRemainingMs(0), cooldownRemainingMs)
    return () => clearTimeout(t)
  }, [cooldownRemainingMs])

  // Body-only (home-ia revamp): the page hosts this inside a Surface (bottom sheet / floating
  // card), which owns the container, "회상" title and close (→ focusActor DISMISS).
  return (
    <>
      {/* 상단 별 포트레이트(change 32): 클릭한 별을 단일 3D로 크게 — 그 별의 룩·추상화 단계·시드·감정색을 우주와
          같은 경로로 재현한다(요지화될수록 단순 실루엣). 패널이 닫히면 RecallView가 언마운트되며 캔버스도 함께 내려간다. */}
      {portrait && (
        // 포트레이트는 메인 우주와 별개의 두 번째 R3F 캔버스다. 렌더러 init 실패가 회상 패널 전체(메타·본문)를
        // 날리거나 전역 앱 폴백으로 새지 않게 자체 경계로 가둔다 — 장식 캔버스라 실패 시 조용히 생략한다.
        <Sentry.ErrorBoundary fallback={<></>}>
          <StarPortrait3D
            look={portrait.look}
            colorHex={portrait.colorHex}
            stage={portrait.stage}
            seed={portrait.seed}
            shapeSeed={portrait.shapeSeed}
          />
        </Sentry.ErrorBoundary>
      )}
      {phase === 'loading' && <p className="text-sm text-white/50">기억을 불러오는 중…</p>}
      {phase === 'error' && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
          ⚠ 이 기억을 불러오지 못했어요.
        </p>
      )}

      {phase === 'shown' && record && (
        // Read-only: no edit/delete controls (constitution §1, acceptance 1.1).
        // ph-no-capture: 일기 원문 영역 — PostHog autocapture가 이 서브트리를 아예
        // 건드리지 않게 한다(프라이버시 헌법 3; mask_all_text 위의 이중 가드).
        <article className="ph-no-capture flex flex-col gap-2">
          {/* 메타: 날짜 · 기분 · 강도 · 추상화(라벨 + 점 게이지). 추상화 단계는 서버 권위(store) — 미수신(데모·구
              응답)이면 0(또렷). 점 게이지로 흐려진 정도를 한눈에(예: 흐릿 ●●●○○). */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span>{record.entryDate}</span>
            <span>·</span>
            <span>{moodLabel(moodFromProto(record.mood))}</span>
            <span>·</span>
            <span>강도 {record.intensity.toFixed(2)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              {abstractionLabel(star?.memory.abstractionStage ?? 0)}
              <span className="tracking-tight text-white/35">
                {abstractionGauge(star?.memory.abstractionStage ?? 0)}
              </span>
            </span>
          </div>
          {(() => {
            // 별 → 조각/흐려진 기억 → 원본 3겹(spec 28·54): 기본 표시는 "흐려진 현재 내용"(AI 내용 변형,
            // 있을 때) > 이 별의 조각 텍스트 > 원본. "원본 일기 전체 보기"를 누르면 불변 Record 전체로 펼친다.
            // 흐려진 내용이 있으면 "내 기억은 흐려졌지만 그날 쓴 말은 그대로"를 토글로 병치한다(헌법1).
            const hasDerived = derivedText !== '' && derivedText !== record.body
            const hasFragment = fragmentText !== '' && fragmentText !== record.body
            const fadedText = hasDerived ? derivedText : hasFragment ? fragmentText : record.body
            const shownText = showFull ? record.body : fadedText
            const canToggle = fadedText !== record.body
            return (
              <>
                {revealed && hasDerived && !showFull && (
                  <p className="text-xs text-white/40">✎ 떠올릴 때마다 조금씩 다시 쓰인 기억</p>
                )}
                {/* 회상 전엔 본문 글자 위에 블러를 올려 가린다(change 35) — placeholder가 아니라 '흐릿하게
                    잠긴' 글자. 회상하면 filter가 0으로 풀리며 또렷이 떠오른다(transition으로 극적으로).
                    가려진 동안은 select-none·pointer-events-none로 복사·상호작용을 막는다. */}
                <div className="relative">
                  <p
                    aria-hidden={!revealed}
                    className={`text-sm leading-relaxed whitespace-pre-wrap text-white/85 transition-[filter,opacity] duration-700 ${
                      revealed
                        ? 'selectable'
                        : 'pointer-events-none blur-[7px] select-none opacity-60'
                    }`}
                  >
                    {shownText}
                  </p>
                  {!revealed && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs text-white/60 backdrop-blur-sm">
                        회상하면 이 기억이 떠올라요
                      </span>
                    </div>
                  )}
                </div>
                {revealed && canToggle && (
                  <button
                    type="button"
                    onClick={() => setShowFull((v) => !v)}
                    className="w-fit text-xs text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline"
                  >
                    {showFull
                      ? hasDerived
                        ? '흐려진 기억 보기'
                        : '조각만 보기'
                      : hasDerived
                        ? '그날 쓴 원본 보기'
                        : '원본 일기 전체 보기'}
                  </button>
                )}
              </>
            )
          })()}
          {/* 의도적 회상(change 35): 클릭 열람은 부작용이 없고, 이 버튼만이 진짜 회상(재점화·재성형·공동회상)을
              일으킨다. 마지막 회상 후 쿨다운 동안은 잠기고 다음 회상까지 남은 시간을 알린다(서버 권위, FE 보조). */}
          <div className="mt-1 flex flex-col gap-1">
            <button
              type="button"
              onClick={onRecall}
              disabled={recalling || cooldownRemainingMs > 0}
              className="hover:border-mood-pink/60 w-fit rounded-full border border-mood-pink/40 px-3 py-1 text-xs text-white/85 transition hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/35"
            >
              {recalling ? '회상하는 중…' : '이 별 자세히 보고 회상하기'}
            </button>
            {cooldownRemainingMs > 0 && (
              <p className="text-xs text-white/40">
                방금 떠올린 기억이에요 · 약 {Math.max(1, Math.ceil(cooldownRemainingMs / 60000))}분 뒤 다시
                회상할 수 있어요
              </p>
            )}
          </div>
          {/* 동선 버튼 묶음: 변천사(24) / 이 일기의 다른 별들(28). 편집·삭제 없음(헌법1). */}
          <div className="mt-1 flex flex-wrap gap-2">
            {/* 변천사 보기(24): 이 별이 변해 온 길을 우주 위 오버레이로 연다(우주를 떠나지 않음). */}
            {onOpenEvolution && (
              <button
                type="button"
                onClick={() => onOpenEvolution(memoryId)}
                className="hover:border-mood-pink/60 w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:text-white"
              >
                변천사 보기
              </button>
            )}
            {/* 이 일기의 다른 별들 보기(28): 같은 record_id 별들을 조망 위치로 프레이밍+강조. */}
            {onSeeDiaryStars && recordId && (
              <button
                type="button"
                onClick={() => onSeeDiaryStars(recordId)}
                className="hover:border-mood-pink/60 w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:text-white"
              >
                이 일기의 다른 별들 보기
              </button>
            )}
          </div>
        </article>
      )}

      {/* 공명 정보 + 별 보내기(spec 36). 공명 중이면 상대 표시명("○○의 우주와 공명 중")과, 상대가
          우주를 공개(35) 중이면 방문 링크를 보인다. "이 별 보내기"는 친구에게 토큰 링크로 보낸다. */}
      {(resonant || onSendStar) && (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
          {resonant && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-indigo-200/80">
              <span>
                {resonance
                  ? `${resonance.partnerDisplayName || '어느'} 우주와 공명 중`
                  : '다른 우주와 공명 중'}
              </span>
              {resonance?.partnerSlug && (
                <a
                  href={`/u/${resonance.partnerSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-200 underline-offset-2 hover:underline"
                >
                  방문
                </a>
              )}
            </p>
          )}
          {onSendStar && (
            <button
              type="button"
              onClick={() => onSendStar(memoryId)}
              className="w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-indigo-400/60 hover:text-white"
            >
              이 별 보내기
            </button>
          )}
        </div>
      )}

      <NeighborNav />
    </>
  )
}

export function MemoryPanel({
  onOpenEvolution,
  onSeeDiaryStars,
  onSendStar,
}: {
  onOpenEvolution?: (memoryId: string) => void
  onSeeDiaryStars?: (recordId: string) => void
  onSendStar?: (memoryId: string) => void
} = {}) {
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  if (!selectedId) return null
  // 첫 별 튜토리얼(change 34): 회상 패널 전체를 정보 하이라이트 target으로 감싼다(A11). 래퍼는 셸 콘텐츠
  // 컬럼의 flex-1 자식이라 긴 본문의 자체 스크롤이 그대로 동작한다.
  return (
    <div data-tour-id="recall-panel" className="flex min-h-0 flex-1 flex-col gap-2">
      <RecallView
        key={selectedId}
        memoryId={selectedId}
        onOpenEvolution={onOpenEvolution}
        onSeeDiaryStars={onSeeDiaryStars}
        onSendStar={onSendStar}
      />
    </div>
  )
}

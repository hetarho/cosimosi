// 감정별 별 스튜디오(change 33) — 13감정 각각의 **색 + 별 형태**를 한 화면에서 편집하는 보호 라우트 풀페이지.
// 좌측 꾸미기 패널은 전역 별 설정만 남고(감정 드롭다운 제거), 감정별 색·형태는 여기로 모인다(마이페이지 감정색
// 섹션도 이전). 13감정을 **단일 공유 Canvas**(CosmosScene)에 그리드로 동시 렌더하고 — 13개 별도 WebGL 컨텍스트
// 금지(헌법8 정신·브라우저 컨텍스트 한도) — **추상화 단계 슬라이더 하나**가 13별 전부에 동시 적용돼 잊혀가며
// 단순해지는 실루엣을 미리 본다(미리보기 전용, 저장값 아님 — abstraction_stage는 별 데이터 파생). 단일 저장이
// 색(saveEmotionColors)·형태(pushSettings emotion_forms + 미소유 룩 purchaseItem)를 함께 커밋한다(기존 규약 재사용).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isDemoMode } from '@/shared/lib/demo'
import { capture, cn, EVENTS } from '@/shared/lib'
import {
  ABSTRACTION_STAGE_MAX,
  MOOD_LABEL,
  isFree,
  isOwned,
  priceOf,
  subItemIds,
  type Mood,
} from '@/shared/config'
import {
  MOOD_ORDER,
  applyInventory,
  applySettings,
  emotionColorsOf,
  emotionFormsOf,
  inventoryQueryOptions,
  mergeEmotionColorDraft,
  pushSettings,
  purchaseItem,
  recommendedEmotionColors,
  saveEmotionColors,
  settingsQueryOptions,
  useAppearance,
} from '@/entities/appearance'
import { STAR_LOOKS, parseStarLook } from '@/entities/star'
import { CosmosScene, type StarVisual } from '@/widgets/cosmos-scene'
import { EmotionColorPicker } from '@/features/pick-emotion-colors'

// 13감정 미리보기 그리드 — 5열 × 3행(15칸, 13 사용). 별 앵커는 셀 중심((col+0.5)/cols,(row+0.5)/rows)이라
// 같은 열·행의 CSS 그리드 라벨과 정렬된다(CosmosScene 앵커는 정규화 스크린 좌표 — aspect 무관 정렬).
const GRID_COLS = 5
const GRID_ROWS = Math.ceil(MOOD_ORDER.length / GRID_COLS)
const PREVIEW_STAR_SIZE = 0.12 // ortho world scale(뷰 높이 2) — 셀(높이 2/rows) 안에 헤일로까지 들어오게

export function EmotionStarStudio() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const demo = isDemoMode()

  // 직접 진입(URL/마이페이지)에서도 store가 시드되도록 settings·inventory를 직접 조회·적용한다(HomePage 미마운트
  // 상태 대비). 이게 없으면 ownedItemIds/stardust가 기본값이라 소유 룩이 잠겨 보이고 저장이 막힌다(codex).
  const { data: settings } = useQuery(settingsQueryOptions())
  useEffect(() => {
    if (settings) applySettings(settings)
  }, [settings])
  const { data: inventory } = useQuery(inventoryQueryOptions())
  useEffect(() => {
    if (inventory) applyInventory(inventory)
  }, [inventory])

  // 전역 기본 룩(미오버라이드 감정 미리보기용). 이 페이지는 전역 4축을 **안 바꾸므로** save에서 전역 축은 보내지
  // 않는다(emotion_forms만) — 직접 진입 시 store 기본값으로 전역 외형을 덮어쓰는 사고를 막는다(codex High).
  const object = useAppearance((s) => s.object)
  const ownedItemIds = useAppearance((s) => s.ownedItemIds)
  const stardust = useAppearance((s) => s.stardust)
  const setStarFormByEmotion = useAppearance((s) => s.setStarFormByEmotion)
  const setEmotionColor = useAppearance((s) => s.setEmotionColor)

  const recommended = useMemo(() => recommendedEmotionColors(), [])
  // 색·형태 draft — settings 응답에서 직접 1회 시드(store hydrate 타이밍과 무관 — 직접 진입에서도 기존 오버라이드
  // 보존). 색은 서버값 우선·없으면 추천(EmotionColorEditor 패턴), 형태는 서버 오버라이드(없는 감정은 전역 기본).
  const [colorDraft, setColorDraft] = useState<Record<Mood, string> | null>(null)
  const [formDraft, setFormDraft] = useState<Record<string, string> | null>(null)
  if (colorDraft === null && settings) setColorDraft(mergeEmotionColorDraft(emotionColorsOf(settings)))
  if (formDraft === null && settings) setFormDraft(emotionFormsOf(settings))
  const [selected, setSelected] = useState<Mood>(MOOD_ORDER[0])
  const [previewStage, setPreviewStage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)

  const lookOf = (mood: Mood): string => parseStarLook(formDraft?.[mood] ?? object)

  // 13감정 미리보기 별 — 그 감정의 색 × 형태(오버라이드 ?? 전역), 단계는 슬라이더(미리보기 전용). 단일 공유 캔버스.
  const stars: StarVisual[] = useMemo(() => {
    if (!colorDraft) return []
    return MOOD_ORDER.map((mood, i) => {
      const col = i % GRID_COLS
      const row = Math.floor(i / GRID_COLS)
      return {
        concept: parseStarLook(formDraft?.[mood] ?? object), // 그 감정 오버라이드, 없으면 전역 기본(미지 룩 폴백)
        color: colorDraft[mood],
        anchor: [(col + 0.5) / GRID_COLS, (row + 0.5) / GRID_ROWS] as [number, number],
        size: PREVIEW_STAR_SIZE,
        seed: i * 7 + 3, // 결정론적 per-emotion 시드(별마다 다른 실루엣)
        stage: previewStage,
      }
    })
  }, [colorDraft, formDraft, object, previewStage])

  // 저장 시 살 미소유 유료 룩(형태 draft 값들) — id로 중복 제거(여러 감정이 같은 룩이면 한 번만 구매). 색은 무상.
  const pending = useMemo(() => {
    if (demo) return []
    const byId = new Map<string, true>()
    for (const look of Object.values(formDraft ?? {}))
      for (const id of subItemIds('star', look)) if (!byId.has(id)) byId.set(id, true)
    return [...byId.keys()].filter((id) => !isFree(id) && !isOwned(id, ownedItemIds))
  }, [demo, formDraft, ownedItemIds])
  const pendingCost = pending.reduce((s, id) => s + (priceOf(id) ?? 0), 0)
  const affordable = stardust >= pendingCost

  const onSave = async () => {
    if (!colorDraft || formDraft === null || saving || !affordable) return
    setSaving(true)
    setError(null)
    setSavedOk(false)
    try {
      if (demo) {
        // 데모는 서버가 없다 — 색·형태를 store에 로컬 무상 확정(우주 미리보기 즉시 반영).
        for (const [mood, hex] of Object.entries(colorDraft)) setEmotionColor(mood, hex)
        for (const [mood, look] of Object.entries(formDraft)) setStarFormByEmotion(mood, look)
      } else {
        // 미소유 룩 먼저 구매(잔액 부족이면 affordable 게이트가 진입 자체를 막아 부분 적용 없음).
        for (const id of pending) {
          await purchaseItem(id)
          capture(EVENTS.appearancePurchase, { item_id: id, axis: 'star', price: priceOf(id) ?? 0 })
        }
        // 형태 오버라이드만 보낸다(emotion_forms 부분 업서트) — 전역 4축은 이 페이지가 안 바꾸므로 보내지 않는다
        // (보내면 store 기본값으로 전역 외형을 덮어쓸 위험, codex). pushSettings는 실패 시 throw가 아니라 false를
        // 반환하므로(settings-query) 반드시 결과를 확인해 색 저장으로 넘어가기 전에 막는다.
        const ok = await pushSettings({ starFormByEmotion: formDraft })
        if (!ok) throw new Error('pushSettings(emotion_forms) failed')
        // 색(emotion_colors full-set) — 별도 패치(서버 거부 시 throw).
        await saveEmotionColors(queryClient, colorDraft)
      }
      setSavedOk(true)
    } catch (e) {
      console.error('[emotion-stars.save]', e)
      setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const saveLabel = saving
    ? '저장 중…'
    : pendingCost > 0
      ? affordable
        ? `저장 · ${pendingCost} 별가루`
        : `별가루 부족 · ${pendingCost}`
      : '저장'

  const selColor = colorDraft?.[selected] ?? '#ffffff'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-medium text-white/90">감정별 별</h1>
          <p className="text-xs text-white/45">13가지 감정마다 색과 별 모양을 정해요.</p>
        </div>
        <button
          type="button"
          onClick={() => void navigate({ to: '/' })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white/90"
        >
          우주로
        </button>
      </header>

      {/* 미리보기 벽 — 단일 공유 Canvas(CosmosScene)에 13감정 별을 그리드로. 위에 라벨/선택 오버레이를 같은 그리드로 겹친다. */}
      <section className="flex flex-col gap-3">
        <div className="relative aspect-5/3 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#05060f]">
          {stars.length > 0 && (
            <CosmosScene stars={stars} twinkle={18} frontClouds={false} grain={false} />
          )}
          {/* 감정 선택 오버레이 — CosmosScene과 같은 5×3 그리드. 셀을 누르면 그 감정을 편집 대상으로. */}
          <div
            className="absolute inset-0 grid gap-0 p-1"
            style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
          >
            {MOOD_ORDER.map((mood) => {
              const active = mood === selected
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setSelected(mood)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-end justify-center rounded-lg pb-1 text-center transition',
                    active ? 'ring-2 ring-white/70 ring-inset bg-white/5' : 'hover:bg-white/5',
                  )}
                >
                  <span className="rounded bg-black/40 px-1 text-[10px] leading-tight text-white/75 backdrop-blur-sm">
                    {MOOD_LABEL[mood]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 추상화 단계 슬라이더 — 13별 전부에 동시 적용(미리보기 전용, 저장값 아님). 범위는 생성 상수에서 파생. */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[11px] text-white/45">
            <span>잊혀가는 단계 미리보기</span>
            <span className="text-white/60">
              {previewStage} / {ABSTRACTION_STAGE_MAX}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={ABSTRACTION_STAGE_MAX}
            step={1}
            value={previewStage}
            onChange={(e) => setPreviewStage(Number(e.target.value))}
            aria-label="추상화 단계 미리보기"
            className="w-full accent-mood-pink"
          />
          <span className="text-[10px] leading-relaxed text-white/35">
            끌면 모든 감정 별이 그 단계의 실루엣으로 바뀌어요 — 잊혀갈수록 단순해지는 모습이에요. (미리보기일 뿐, 저장되지 않아요.)
          </span>
        </label>
      </section>

      {/* 선택 감정 편집 — 형태 룩 라디오 + 색 피커. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/3 p-4">
        <span className="text-sm text-white/85">{MOOD_LABEL[selected]}</span>

        {/* 별 형태 룩(전역 3종 — 그 감정 오버라이드, 없으면 전역 기본). */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-white/45">별 — 형태</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${MOOD_LABEL[selected]} 별 형태`}>
            {STAR_LOOKS.map((l) => {
              const active = lookOf(selected) === l.id
              const itemId = `star:look:${l.id}`
              const locked = !demo && !isFree(itemId) && !isOwned(itemId, ownedItemIds)
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={`${l.name} — ${l.tagline}`}
                  // 드래프트 시드(settings) 전엔 비활성 — 클릭이 형태 draft를 부분값으로 굳혀 기존 오버라이드 시드를 막는 걸 방지.
                  disabled={formDraft === null}
                  onClick={() => setFormDraft((d) => ({ ...(d ?? {}), [selected]: l.id }))}
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-white/70',
                    active ? 'ring-2 ring-white/90 scale-110' : 'opacity-70 ring-1 ring-white/10 hover:opacity-100',
                  )}
                  style={{ background: l.swatch }}
                >
                  {locked && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-amber-300/90 px-1 text-[8px] font-bold text-black">
                      {priceOf(itemId)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 감정 색 — 기존 HSV 피커 재사용. */}
        {colorDraft && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-white/45">색</span>
            <EmotionColorPicker
              value={selColor}
              recommended={recommended[selected]}
              onChange={(hex) => setColorDraft((d) => (d ? { ...d, [selected]: hex } : d))}
              label={MOOD_LABEL[selected]}
            />
          </div>
        )}
      </section>

      {/* 단일 저장 — 색 + 형태(+미소유 룩 구매)를 함께 커밋. 잔액 부족이면 비활성(부분 적용 없음). */}
      <div className="flex items-center gap-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-white/55">별가루 {stardust}</div>
        {error && <span className="text-xs text-red-300/80">{error}</span>}
        {savedOk && (
          <span className="text-xs text-emerald-300/80" role="status">
            저장했어요.
          </span>
        )}
        <button
          type="button"
          onClick={() => void onSave()}
          aria-disabled={!affordable || saving}
          className={cn(
            'ml-auto rounded-full px-6 py-2.5 text-sm font-medium transition',
            affordable && !saving ? 'bg-white/90 text-black hover:bg-white' : 'cursor-not-allowed bg-white/10 text-white/40',
          )}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

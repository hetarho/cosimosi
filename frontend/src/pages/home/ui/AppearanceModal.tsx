// 외형 편집기 모달(spec 44 change 06) — 집중 모달. 상단 고정 프리뷰(나 + 별 3개 + 강·약 시냅스, CosmosScene
// 재사용)가 현재 드래프트 4축을 라이브로 보여주고, 탭(배경/별/광원/시냅스)별로 항목을 고른다. 항목 칩은 의미
// 약한 그라디언트가 아니라 **실제 모형**(작은 CosmosScene)을 띄운다 — 활성 탭의 항목만 마운트하고, 모달이
// 열리면 HomePage가 우주 캔버스를 언마운트해 WebGPU 컨텍스트를 묶는다(라이브 미니 3D 결정, A6 수정).
// 선택은 드래프트 미리보기(자동 저장 안 함). 모달 헤더의 **뒤로가기**(변경 있으면 미저장 경고)와 **저장**(미구매분
// 일괄 구매 포함)으로 끝낸다. 체험은 전부 잠금 해제·무상 저장. 광원 탭 = 나(self) 축.
import { useState } from 'react'
import { ArrowLeft, Lock, Sparkles } from 'lucide-react'
import { CosmosScene, type StarVisual, type SynapseVisual } from '@/widgets/cosmos-scene'
import { isDemoMode } from '@/shared/lib/demo'
import { capture, cn, EVENTS } from '@/shared/lib'
import { MOOD, itemId, isFree, isOwned, priceOf, type Axis } from '@/shared/config'
import {
  THEMES,
  SELF_OBJECTS,
  backgroundMeta,
  paletteForBackground,
  themeAccent,
  useAppearance,
  pushSettings,
  purchaseItem,
  type Theme,
  type SelfObject,
} from '@/entities/appearance'
import { STAR_OBJECTS, type StarObject } from '@/entities/star'
import { SYNAPSE_STYLES, type SynapseStyle } from '@/entities/synapse'

const TABS: { key: Axis; label: string }[] = [
  { key: 'background', label: '배경' },
  { key: 'star', label: '별' },
  { key: 'self', label: '광원' },
  { key: 'synapse', label: '시냅스' },
]

// 미니 3D 썸네일/프리뷰의 표본 mood 색(hex). 색=의미라 미리보기는 mood 팔레트에서 가져온다.
const STAR_MOODS = [MOOD.amber, MOOD.violet, MOOD.teal] as const

/** 항목 칩의 실제 모형 썸네일 — 작은 CosmosScene(quality low·트윙클/구름/그레인 끔). 활성 탭만 마운트된다. */
function ItemThumbnail({
  axis,
  kind,
  palette,
  accent,
}: {
  axis: Axis
  kind: string
  palette: ReturnType<typeof paletteForBackground>
  accent: string
}) {
  if (axis === 'background') {
    const meta = backgroundMeta(kind as Theme)
    return (
      <CosmosScene palette={meta.palette} texture={meta.texture} twinkle={36} grain={false} frontClouds={false} quality="low" />
    )
  }
  if (axis === 'star') {
    return (
      <CosmosScene
        palette={palette}
        stars={[{ concept: kind as StarObject, color: STAR_MOODS[0], anchor: [0.5, 0.5], size: 0.5, seed: 7 }]}
        twinkle={0}
        grain={false}
        frontClouds={false}
        quality="low"
      />
    )
  }
  if (axis === 'self') {
    return (
      <CosmosScene
        palette={palette}
        self={{ concept: kind as SelfObject, color: accent, anchor: [0.5, 0.5], size: 0.5, seed: 7 }}
        twinkle={0}
        grain={false}
        frontClouds={false}
        quality="low"
      />
    )
  }
  // synapse: 두 별 사이 한 표본 가닥(선택 스타일).
  const [cA, cB] = [MOOD.violet, MOOD.teal]
  return (
    <CosmosScene
      palette={palette}
      stars={[
        { concept: 'deepfield', color: cA, anchor: [0.26, 0.5], size: 0.2, seed: 3 },
        { concept: 'deepfield', color: cB, anchor: [0.74, 0.5], size: 0.2, seed: 9 },
      ]}
      synapses={[{ a: [0.26, 0.5], b: [0.74, 0.5], colorA: cA, colorB: cB, weight: 0.85, style: kind as SynapseStyle }]}
      twinkle={0}
      grain={false}
      frontClouds={false}
      quality="low"
    />
  )
}

/** 고정 라이브 프리뷰 — 나 + 별 3개를 강·약 시냅스로 잇고, 현재 드래프트 4축(배경 팔레트/텍스처·별 형태·나
 *  형태·시냅스 스타일)을 라이브로 반영한다. store를 직접 구독해 탭/항목을 바꾸면 즉시 갱신된다. */
function FixedPreview() {
  const theme = useAppearance((s) => s.theme)
  const object = useAppearance((s) => s.object)
  const selfObject = useAppearance((s) => s.selfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const palette = paletteForBackground(theme)
  const accent = themeAccent(theme)
  const texture = backgroundMeta(theme).texture

  const stars: StarVisual[] = [
    { concept: object, color: STAR_MOODS[0], anchor: [0.33, 0.36], size: 0.15, seed: 3 },
    { concept: object, color: STAR_MOODS[1], anchor: [0.7, 0.43], size: 0.12, seed: 7 },
    { concept: object, color: STAR_MOODS[2], anchor: [0.54, 0.72], size: 0.1, seed: 11 },
  ]
  const self = { concept: selfObject, color: accent, anchor: [0.5, 0.52] as [number, number], size: 0.13, seed: 5 }
  // 강한 연결(self↔가까운 별, weight 0.85) + 약한 연결(self↔먼 별 0.35; 별↔별 0.55).
  const synapses: SynapseVisual[] = [
    { a: [0.5, 0.52], b: [0.33, 0.36], colorA: accent, colorB: STAR_MOODS[0], weight: 0.85, style: synapseStyle },
    { a: [0.5, 0.52], b: [0.7, 0.43], colorA: accent, colorB: STAR_MOODS[1], weight: 0.35, style: synapseStyle },
    { a: [0.33, 0.36], b: [0.54, 0.72], colorA: STAR_MOODS[0], colorB: STAR_MOODS[2], weight: 0.55, style: synapseStyle },
  ]
  return (
    <CosmosScene stars={stars} self={self} synapses={synapses} palette={palette} texture={texture} grain={false} />
  )
}

export interface AppearanceModalProps {
  open: boolean
  onClose: () => void
}

/** 외형 편집기 모달. HomePage가 좌상단 알약/메뉴로 연다. 열리는 동안 HomePage는 우주 캔버스를 언마운트한다. */
export function AppearanceModal({ open, onClose }: AppearanceModalProps) {
  const [tab, setTab] = useState<Axis>('background')
  const theme = useAppearance((s) => s.theme)
  const setTheme = useAppearance((s) => s.setTheme)
  const object = useAppearance((s) => s.object)
  const setObject = useAppearance((s) => s.setObject)
  const selfObject = useAppearance((s) => s.selfObject)
  const setSelfObject = useAppearance((s) => s.setSelfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const setSynapseStyle = useAppearance((s) => s.setSynapseStyle)
  const ownedItemIds = useAppearance((s) => s.ownedItemIds)
  const saved = useAppearance((s) => s.savedSelection)
  const stardust = useAppearance((s) => s.stardust)
  const commitSelection = useAppearance((s) => s.commitSelection)
  const revertSelection = useAppearance((s) => s.revertSelection)
  const [saving, setSaving] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  if (!open) return null

  const unlocked = isDemoMode()
  const palette = paletteForBackground(theme)
  const accent = themeAccent(theme)

  // 드래프트 여부(라이브 ≠ 마지막 저장) + 저장 시 살 미구매 유료 아이템(체험은 전부 무상이라 없음).
  const dirty =
    theme !== saved.theme ||
    object !== saved.object ||
    selfObject !== saved.selfObject ||
    synapseStyle !== saved.synapseStyle
  const selected: [Axis, string][] = [
    ['background', theme],
    ['star', object],
    ['self', selfObject],
    ['synapse', synapseStyle],
  ]
  const pending = unlocked
    ? []
    : selected
        .map(([ax, k]) => ({ axis: ax, id: itemId(ax, k) }))
        .filter((p) => !isFree(p.id) && !isOwned(p.id, ownedItemIds))
  const pendingCost = pending.reduce((s, p) => s + (priceOf(p.id) ?? 0), 0)
  const affordable = stardust >= pendingCost

  const cfg = {
    background: { metas: THEMES, value: theme, set: (k: string) => setTheme(k as Theme) },
    star: { metas: STAR_OBJECTS, value: object, set: (k: string) => setObject(k as StarObject) },
    self: { metas: SELF_OBJECTS, value: selfObject, set: (k: string) => setSelfObject(k as SelfObject) },
    synapse: { metas: SYNAPSE_STYLES, value: synapseStyle, set: (k: string) => setSynapseStyle(k as SynapseStyle) },
  }[tab]

  const onSelect = (kind: string) => {
    if (kind === cfg.value) return // 같은 선택 재클릭은 전환 아님
    // 라이브 드래프트 = 프리뷰 즉시 반영. 자동 저장 안 함 — 헤더 저장 버튼이 커밋한다. 모달은 홈 전용·항상 드래프트.
    cfg.set(kind)
    capture(EVENTS.appearanceSwitch, { axis: tab, kind })
  }

  // 저장(구매 포함): 미구매 유료 아이템을 먼저 사고(체험은 없음) 4축을 영속한 뒤 닫는다. 변경 없으면 그냥 닫는다.
  const onSave = async () => {
    if (saving || !affordable) return
    if (!dirty) {
      onClose()
      return
    }
    setSaving(true)
    try {
      for (const p of pending) {
        await purchaseItem(p.id)
        capture(EVENTS.appearancePurchase, { item_id: p.id, axis: p.axis, price: priceOf(p.id) ?? 0 })
      }
      const ok = await pushSettings({ theme, starObject: object, selfObject, synapseStyle })
      if (ok || unlocked) commitSelection()
      onClose()
    } catch (e) {
      console.error('[appearance.save]', e)
    } finally {
      setSaving(false)
    }
  }

  // 뒤로가기: 변경이 있으면 미저장 경고, 없으면 그냥 닫는다. 경고에서 "나가기"는 드래프트를 버리고(마지막 저장 복원) 닫는다.
  const onBack = () => {
    if (dirty) setConfirmExit(true)
    else onClose()
  }
  const onDiscardExit = () => {
    revertSelection()
    setConfirmExit(false)
    onClose()
  }

  const saveLabel = saving
    ? '저장 중…'
    : pendingCost > 0
      ? affordable
        ? `저장 · ${pendingCost} 별가루`
        : `별가루 부족 · ${pendingCost}`
      : '저장'

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-[#05060f]/95 backdrop-blur-md">
      {/* 헤더: 뒤로(좌). 저장은 우상단 SessionGate 칩(체험 종료/로그아웃, z-50)과 겹치지 않게 하단 command bar로. */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white/95"
        >
          <ArrowLeft className="size-4" aria-hidden />
          뒤로
        </button>
        <span className="text-sm uppercase tracking-[0.2em] text-white/45">외형</span>
      </header>

      {/* 고정 라이브 프리뷰 */}
      <div className="relative h-[32vh] min-h-45 w-full shrink-0 overflow-hidden">
        <FixedPreview />
      </div>

      {/* 탭 */}
      <div role="tablist" aria-label="외형 축" className="flex gap-1 border-b border-white/10 px-4">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-4 py-2.5 text-sm outline-none transition focus-visible:text-white',
                active ? 'text-white' : 'text-white/45 hover:text-white/75',
              )}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-white/80" />}
            </button>
          )
        })}
      </div>

      {/* 항목 리스트(활성 탭 — 실제 모형 썸네일). */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cfg.metas.map((m) => {
            const id = itemId(tab, m.id)
            const locked = !unlocked && !isOwned(id, ownedItemIds)
            const price = priceOf(id)
            const active = m.id === cfg.value
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                aria-pressed={active}
                className={cn(
                  'group flex flex-col gap-2 rounded-2xl border p-2 text-left transition',
                  active ? 'border-white/70 bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/30',
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/40">
                  <ItemThumbnail axis={tab} kind={m.id} palette={palette} accent={accent} />
                  {locked && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/55">
                      <Lock className="size-3 text-white/85" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="px-1 pb-0.5">
                  <p className="truncate text-sm text-white/90">{m.name}</p>
                  {locked && price != null ? (
                    <span className="flex items-center gap-1 text-[11px] text-amber-200/80">
                      <Sparkles className="size-3" aria-hidden />
                      저장 시 {price} 별가루
                    </span>
                  ) : (
                    <p className="truncate text-[11px] text-white/45">{m.tagline}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 저장(구매 포함) — 하단 command bar(우상단 SessionGate 칩과 안 겹치게 헤더 대신 여기). */}
      <div className="shrink-0 border-t border-white/10 px-5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => void onSave()}
          aria-disabled={!affordable || saving}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition',
            affordable && !saving
              ? 'bg-white/90 text-black hover:bg-white'
              : 'cursor-not-allowed bg-white/10 text-white/40',
          )}
        >
          {pendingCost > 0 && <Sparkles className="size-3.5" aria-hidden />}
          {saveLabel}
        </button>
      </div>

      {/* 미저장 경고 — 뒤로가기 시 드래프트가 마지막 저장과 다르면. "나가기"는 드래프트를 버리고 마지막 저장으로 복원. */}
      {confirmExit && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/65 p-6">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0c0e1c] p-5 text-center">
            <p className="text-sm text-white/90">변경사항이 저장되지 않아요</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">
              지금 나가면 고른 외형이 사라지고 마지막 저장 상태로 돌아가요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:text-white/95"
              >
                계속 편집
              </button>
              <button
                type="button"
                onClick={onDiscardExit}
                className="flex-1 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-black transition hover:bg-white"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

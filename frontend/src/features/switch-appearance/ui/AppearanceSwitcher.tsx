import { useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Lock, Palette, Sparkles, X } from 'lucide-react'
import { capture, cn, EVENTS } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { itemId, isOwned, priceOf, type Axis } from '@/shared/config'
import {
  BACKGROUNDS,
  SELF_OBJECTS,
  useAppearance,
  type Theme,
  type SelfObject,
} from '@/entities/appearance'
import { STAR_OBJECTS, type StarObject } from '@/entities/star'
import { SYNAPSE_STYLES, type SynapseStyle } from '@/entities/synapse'

/** 인벤토리 칩 — 시각 미리보기(swatch) + 소유/잠금/가격 상태. */
interface ChipItem {
  /** kind id(축 접두 없이) — store 선택값과 같다. */
  id: string
  name: string
  tagline: string
  swatch: string
  /** 미소유 유료 아이템(잠금 배지). */
  locked: boolean
  /** 유료 아이템 가격(별가루). 무료면 undefined. */
  price?: number
  /** 감정 슬롯 수(배경의 주 감정 표시 개수용) */
  slots?: number
}

/**
 * WAI-ARIA radiogroup(인벤토리). 칩들이 role="radio"이므로 키보드 계약(화살표로 이동, 그룹은 단일 Tab
 * 정지점)을 지킨다: roving tabindex + 화살표 핸들러. 드래프트(홈)·플레이그라운드에선 잠긴 칩도 선택(미리보기)
 * 가능하고, 잠긴 칩엔 자물쇠 배지를 띄워 "유료(저장 시 구매)"임을 알린다 — 구매는 플로팅 저장 버튼이 한 번에.
 */
function InventoryRadioGroup({
  label,
  groupLabel,
  items,
  value,
  unlocked,
  draft,
  onSelect,
}: {
  /** 그룹 위에 보이는 텍스트 라벨. */
  label: string
  /** 스크린리더용 그룹 이름. */
  groupLabel: string
  items: ChipItem[]
  value: string
  /** 플레이그라운드(미인증·체험): 전부 선택 가능, 잠금/가격 배지 억제. */
  unlocked: boolean
  /** 드래프트(홈 실로그인): 잠긴 아이템도 미리보기로 선택 가능(자물쇠 배지는 보임). 저장은 플로팅 버튼이. */
  draft: boolean
  /** 선택(미리보기). */
  onSelect: (kind: string) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIdx = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  )
  const [focusIdx, setFocusIdx] = useState(selectedIdx)
  // 선택값이 밖에서 바뀌면(서버 설정 동기·구매 자동선택) roving 탭 정지점을 선택 칩으로 재동기해, Tab으로
  // 그룹에 들어올 때 포커스가 aria-checked 칩에 안착하게 한다(렌더 중 보정 — effect-setState 회피).
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setFocusIdx(selectedIdx)
  }
  const idx = focusIdx < items.length ? focusIdx : 0
  const described = items[idx] ?? items[0]
  const selectable = (it: ChipItem) => unlocked || draft || !it.locked

  const move = (dir: number) => {
    const next = (idx + dir + items.length) % items.length
    setFocusIdx(next)
    const it = items[next]
    if (selectable(it)) onSelect(it.id)
    refs.current[next]?.focus()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    move(dir)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] text-white/45">{label}</span>
      <div
        className="flex flex-wrap items-center gap-2.5"
        role="radiogroup"
        aria-label={groupLabel}
        onKeyDown={onKeyDown}
      >
        {items.map((it, i) => {
          const isActive = it.id === value
          const locked = !unlocked && it.locked
          return (
            <button
              key={it.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${it.name} — ${it.tagline}${locked ? ` · 잠김 · ${it.price} 별가루` : ''}`}
              title={`${it.name} — ${it.tagline}`}
              tabIndex={i === idx ? 0 : -1}
              onClick={() => {
                setFocusIdx(i)
                if (selectable(it)) onSelect(it.id)
              }}
              onFocus={() => setFocusIdx(i)}
              className={cn(
                'relative grid size-8 place-items-center rounded-full outline-none ring-offset-2 ring-offset-transparent transition',
                'focus-visible:ring-2 focus-visible:ring-white/70',
                isActive
                  ? 'ring-2 ring-white/90 scale-110'
                  : 'opacity-70 ring-1 ring-white/10 hover:opacity-100 hover:scale-105',
                locked && 'opacity-50',
              )}
              style={{ background: it.swatch }}
            >
              {locked && <Lock className="size-3 text-white/90 drop-shadow" aria-hidden />}
            </button>
          )
        })}
      </div>
      <p className="leading-tight">
        <span className="font-display text-sm text-white/90">
          {described.name}
          {described.slots !== undefined && (
            <span className="ml-1.5 inline-flex items-center rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
              주 감정 {described.slots}개
            </span>
          )}
        </span>
        <span className="block text-[11px] text-white/45">{described.tagline}</span>
        {!unlocked && described.locked && described.price != null && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-200/80">
            <Sparkles className="size-3" aria-hidden />
            잠김 · 저장 시 {described.price} 별가루
          </span>
        )}
      </p>
    </div>
  )
}

/** axis 설정 — 라벨·카탈로그·store 선택값/세터를 한 곳에. */
type AxisConfig = {
  axis: Axis
  label: string
  groupLabel: string
  metas: readonly { id: string; name: string; tagline: string; swatch: string }[]
  value: string
  setX: (kind: string) => void
}

/**
 * 4축 인벤토리 컨트롤 본문(appearance + synapse entity): 배경·별·나·시냅스를 라디오그룹으로 고른다.
 * 선택은 라이브로 우주에 미리보인다. 미인증 플레이그라운드(랜딩·사인인·초대 FAB)는 `playground`로 전부
 * 잠금 해제·로컬 즉시 확정하고, 홈 우주 편집 패널(`pages/home/ui/AppearancePanel`, change 10)은 `draft`로
 * 이 본문을 그대로 호스팅한다 — `draft` 모드는 잠긴 아이템도 미리보기로 고르되 자동 저장하지 않고(패널의
 * 저장 바가 구매·커밋), 선택 결과는 별도 샘플이 아니라 실제 메인 우주에서 라이브로 확인된다.
 */
export function AppearanceControls({
  playground = false,
  draft = false,
}: {
  playground?: boolean
  /** 드래프트 모드(홈 실로그인): 모든 칩 미리보기 선택·자동 저장 안 함(플로팅 저장 버튼이 커밋). */
  draft?: boolean
}) {
  const unlocked = playground || isDemoMode()

  const theme = useAppearance((s) => s.theme)
  const setTheme = useAppearance((s) => s.setTheme)
  const object = useAppearance((s) => s.object)
  const setObject = useAppearance((s) => s.setObject)
  const selfObject = useAppearance((s) => s.selfObject)
  const setSelfObject = useAppearance((s) => s.setSelfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const setSynapseStyle = useAppearance((s) => s.setSynapseStyle)
  const stardust = useAppearance((s) => s.stardust)
  const ownedItemIds = useAppearance((s) => s.ownedItemIds)
  const commitSelection = useAppearance((s) => s.commitSelection)

  const axes: AxisConfig[] = [
    {
      axis: 'background',
      label: '배경 — 색·텍스처',
      groupLabel: '배경',
      metas: BACKGROUNDS,
      value: theme,
      setX: (k) => setTheme(k as Theme),
    },
    {
      axis: 'star',
      label: '별 — 형태',
      groupLabel: '별 형태',
      metas: STAR_OBJECTS,
      value: object,
      setX: (k) => setObject(k as StarObject),
    },
    {
      axis: 'self',
      label: '나 — 중심 별의 형태',
      groupLabel: '자아 별 형태',
      metas: SELF_OBJECTS,
      value: selfObject,
      setX: (k) => setSelfObject(k as SelfObject),
    },
    {
      axis: 'synapse',
      label: '시냅스 — 연결선 스타일',
      groupLabel: '시냅스 스타일',
      metas: SYNAPSE_STYLES,
      value: synapseStyle,
      setX: (k) => setSynapseStyle(k as SynapseStyle),
    },
  ]

  const buildItems = (cfg: AxisConfig): ChipItem[] =>
    cfg.metas.map((m) => {
      const id = itemId(cfg.axis, m.id)
      return {
        id: m.id,
        name: m.name,
        tagline: m.tagline,
        swatch: m.swatch,
        locked: !isOwned(id, ownedItemIds),
        price: priceOf(id),
        slots: 'emotionSlots' in m ? (m as unknown as { emotionSlots?: number }).emotionSlots : undefined,
      }
    })

  const onSelect = (cfg: AxisConfig) => (kind: string) => {
    if (kind === cfg.value) return // 같은 선택 재클릭은 전환이 아니다 — 이벤트 오염 방지
    cfg.setX(kind) // 라이브 선택 갱신 = 우주 즉시 미리보기
    // 플레이그라운드(랜딩/사인인 FAB)는 저장 바가 없으니 로컬로 즉시 확정. 드래프트(홈 — 실로그인·체험
    // 모두)는 미리보기만 두고 플로팅 저장 바가 커밋한다(체험은 전부 잠금 해제라 무상 저장).
    if (!draft) commitSelection()
    capture(EVENTS.appearanceSwitch, { axis: cfg.axis, kind }) // 외형 기능 사용률(18)
  }

  return (
    <>
      {!unlocked && (
        <div className="flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80">
          <Sparkles className="size-3 text-amber-200/90" aria-hidden />
          별가루 {stardust}
        </div>
      )}
      {axes.map((cfg, i) => (
        <div key={cfg.axis} className="flex flex-col gap-4">
          {i > 0 && <div className="h-px bg-white/10" />}
          <InventoryRadioGroup
            label={cfg.label}
            groupLabel={cfg.groupLabel}
            items={buildItems(cfg)}
            value={cfg.value}
            unlocked={unlocked}
            draft={draft}
            onSelect={onSelect(cfg)}
          />
        </div>
      ))}
    </>
  )
}

export interface AppearanceSwitcherProps {
  /** 고정 위치 유틸리티 클래스(미지정 시 우하단). 라우트마다 HUD와 안 겹치게 배치한다. */
  className?: string
}

/**
 * 플로팅 시각 설정 스위처(랜딩·사인인·초대 = 플레이그라운드 진입) — 접힌 FAB을 누르면 4축 인벤토리
 * `AppearanceControls`가 펼쳐진다. 미인증 진입점이라 항상 playground(전부 잠금 해제·미저장). 우주
 * 메인(`/`)은 이 FAB 대신 "메뉴"의 "테마·외형" 항목이 같은 본문을 비차단 Surface로 띄운다(인증·실잠금).
 */
export function AppearanceSwitcher({ className }: AppearanceSwitcherProps) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'fixed z-50',
        // 기본(랜딩 등 className 미지정): 홈 인디케이터/제스처 바를 비키도록 safe-area 보정.
        className ??
          'bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass flex max-h-[80vh] w-64 flex-col gap-4 overflow-y-auto rounded-3xl p-4"
          >
            <div className="flex items-center justify-between gap-6">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/55">외형</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="스위처 접기"
                className="grid size-6 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <AppearanceControls playground />
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="외형 스위처 열기"
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            className="glass grid size-12 place-items-center rounded-full text-white/80 transition hover:text-white"
          >
            <Palette className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Palette, X } from 'lucide-react'
import { capture, cn, EVENTS } from '@/shared/lib'
import { THEMES, SELF_OBJECTS, useAppearance, pushSettings } from '@/entities/appearance'
import { STAR_OBJECTS } from '@/entities/star'

interface ChipItem {
  id: string
  name: string
  tagline: string
  swatch: string
}

/**
 * WAI-ARIA radiogroup. 칩들이 role="radio"이므로 키보드 계약(화살표로 이동·선택, 그룹은 단일 Tab
 * 정지점)을 지킨다: roving tabindex(선택된 칩만 tabIndex 0) + 화살표 키 핸들러로 선택+포커스 이동.
 */
function SwatchRadioGroup({
  label,
  groupLabel,
  items,
  value,
  onChange,
}: {
  /** 그룹 위에 보이는 텍스트 라벨. */
  label: string
  /** 스크린리더용 그룹 이름. */
  groupLabel: string
  items: ChipItem[]
  value: string
  onChange: (id: string) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const active = items.find((i) => i.id === value) ?? items[0]

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const idx = items.findIndex((i) => i.id === value)
    const next = (idx + dir + items.length) % items.length
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] text-white/45">{label}</span>
      <div className="flex items-center gap-2.5" role="radiogroup" aria-label={groupLabel} onKeyDown={onKeyDown}>
        {items.map((it, i) => {
          const isActive = it.id === value
          return (
            <button
              key={it.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${it.name} — ${it.tagline}`}
              title={`${it.name} — ${it.tagline}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(it.id)}
              className={cn(
                'size-8 rounded-full outline-none ring-offset-2 ring-offset-transparent transition',
                'focus-visible:ring-2 focus-visible:ring-white/70',
                isActive
                  ? 'ring-2 ring-white/90 scale-110'
                  : 'opacity-70 ring-1 ring-white/10 hover:opacity-100 hover:scale-105',
              )}
              style={{ background: it.swatch }}
            />
          )
        })}
      </div>
      <p className="leading-tight">
        <span className="font-display text-sm text-white/90">{active.name}</span>
        <span className="block text-[11px] text-white/45">{active.tagline}</span>
      </p>
    </div>
  )
}

export interface AppearanceSwitcherProps {
  /** 고정 위치 유틸리티 클래스(미지정 시 우하단). 라우트마다 HUD와 안 겹치게 배치한다. */
  className?: string
}

/**
 * 플로팅 시각 설정 스위처. 두 축을 각각 라디오그룹으로 고른다(appearance entity):
 *   · 테마(3) — 색·분위기(vast/lively/calm). 배경·글래스·accent가 함께 전환.
 *   · 오브제(4) — 별의 형태(deepfield/aurora/liquid/ember). 3D·2D 공통.
 * 선택은 localStorage에 지속되어 새로고침해도 유지된다. 기본은 접힌 FAB. 랜딩·우주 양쪽에서 띄운다.
 */
export function AppearanceSwitcher({ className }: AppearanceSwitcherProps) {
  const reduce = useReducedMotion()
  const theme = useAppearance((s) => s.theme)
  const setTheme = useAppearance((s) => s.setTheme)
  const object = useAppearance((s) => s.object)
  const setObject = useAppearance((s) => s.setObject)
  const selfObject = useAppearance((s) => s.selfObject)
  const setSelfObject = useAppearance((s) => s.setSelfObject)
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
            className="glass flex w-60 flex-col gap-4 rounded-3xl p-4"
          >
            <div className="flex items-center justify-between gap-6">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/55">테마 · 오브제</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="스위처 접기"
                className="grid size-6 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <SwatchRadioGroup
              label="테마 — 색·분위기"
              groupLabel="색 테마"
              items={THEMES}
              value={theme}
              onChange={(id) => {
                if (id === theme) return // 같은 테마 재클릭은 전환이 아니다 — 이벤트 오염 방지
                setTheme(id as (typeof THEMES)[number]['id'])
                void pushSettings({ theme: id }) // 서버 영속(인증 시; 미인증·체험은 로컬만) — spec 30
                capture(EVENTS.appearanceSwitch, { theme: id }) // 외형 기능 사용률(18)
              }}
            />

            <div className="h-px bg-white/10" />

            <SwatchRadioGroup
              label="오브제 — 별의 형태"
              groupLabel="별 오브제 형태"
              items={STAR_OBJECTS}
              value={object}
              onChange={(id) => {
                const obj = id as (typeof STAR_OBJECTS)[number]['id']
                setObject(obj)
                void pushSettings({ starObject: obj }) // 서버 영속(인증 시) — spec 30
              }}
            />

            <div className="h-px bg-white/10" />

            {/* 자아 별(나) 형태 — 우주 중심 앵커(spec 38). 기기 로컬 선호(서버 동기는 후속). */}
            <SwatchRadioGroup
              label="나 — 중심 별의 형태"
              groupLabel="자아 별 형태"
              items={SELF_OBJECTS}
              value={selfObject}
              onChange={(id) => setSelfObject(id as (typeof SELF_OBJECTS)[number]['id'])}
            />
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="테마·오브제 스위처 열기"
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

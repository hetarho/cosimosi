import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Palette, X } from 'lucide-react'
import { cn } from '@/shared/lib'
import { THEMES, useLandingTheme } from '../model/theme'

/**
 * 플로팅 테마 스위처(우하단 고정). 4개 전체-페이지 테마를 칩으로 전환·비교한다.
 * 선택은 localStorage에 지속(theme store)되어 새로고침해도 유지된다. 접어둘 수 있다.
 */
export function ThemeSwitcher() {
  const reduce = useReducedMotion()
  const theme = useLandingTheme((s) => s.theme)
  const setTheme = useLandingTheme((s) => s.setTheme)
  // 기본은 접힌 FAB. 첫인상의 주의 예산을 콘텐츠·CTA에 양보하고, 원하는 사람만 펼쳐 테마를 비교한다.
  const [open, setOpen] = useState(false)
  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass flex flex-col gap-3 rounded-3xl p-4"
          >
            <div className="flex items-center justify-between gap-6">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/55">테마</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="테마 스위처 접기"
                className="grid size-6 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {THEMES.map((t) => {
                const isActive = t.id === theme
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-pressed={isActive}
                    aria-label={`${t.name} 테마로 전환`}
                    title={`${t.name} — ${t.tagline}`}
                    className={cn(
                      'size-8 rounded-full outline-none ring-offset-2 ring-offset-transparent transition',
                      'focus-visible:ring-2 focus-visible:ring-white/70',
                      isActive
                        ? 'ring-2 ring-white/90 scale-110'
                        : 'opacity-70 ring-1 ring-white/10 hover:opacity-100 hover:scale-105',
                    )}
                    style={{ background: t.swatch }}
                  />
                )
              })}
            </div>

            <div className="leading-tight">
              <p className="font-display text-sm text-white/90">{active.name}</p>
              <p className="text-[11px] text-white/45">{active.tagline}</p>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="테마 스위처 열기"
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

// 다크 테마 커스텀 드롭다운(shared/ui) — 네이티브 <select>의 열린 옵션 목록은 OS가 흰 배경으로
// 그려 앱 톤과 어긋나므로(브라우저가 그 부분은 CSS로 못 바꿈), 트리거 버튼 + 팝오버 목록을 직접
// 그린다. 옵션마다 선택 swatch(예: 감정 색 점)를 받을 수 있다. 바깥 클릭·Esc로 닫힌다.
import { useEffect, useRef, useState } from 'react'

export interface DropdownOption<T extends string | number> {
  value: T
  label: string
  /** 선택지 앞에 찍을 색 점(예: 감정 색). 없으면 점을 그리지 않는다. */
  color?: string
}

export interface DropdownProps<T extends string | number> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  // 바깥 클릭·Esc로 닫기 — 열렸을 때만 리스너를 단다.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function dot(color: string) {
    return (
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
    )
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-indigo-400/50 disabled:opacity-50"
      >
        {selected?.color && dot(selected.color)}
        <span className="flex-1 truncate text-left">{selected?.label ?? ''}</span>
        <span aria-hidden className="text-white/40">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border border-white/10 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur"
        >
          {options.map((o) => {
            const active = o.value === value
            return (
              <li key={String(o.value)} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                    active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  {o.color && dot(o.color)}
                  <span className="flex-1 truncate">{o.label}</span>
                  {active && (
                    <span aria-hidden className="text-indigo-300">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

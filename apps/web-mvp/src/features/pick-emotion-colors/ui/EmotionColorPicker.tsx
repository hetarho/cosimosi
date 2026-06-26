// 커스텀 감정색 피커(spec 45) — 네이티브 <input type="color">를 주 UI로 노출하지 않고, saturation/value 면 +
// hue rail + hex 입력 + 추천 복귀 + (지원 시) EyeDropper를 앱 UI로 제공한다. 색 모델은 내부 HSV로 조작하고
// 저장은 #RRGGBB 하나로 한다. pointer/touch drag + keyboard arrow + roving focus 지원, reduced-motion 존중.
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Pipette, RotateCcw } from 'lucide-react'
import { normalizeHex } from '@/entities/appearance'

interface HSV {
  h: number // 0..360
  s: number // 0..1
  v: number // 0..1
}

/** "#RRGGBB" → HSV. */
function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

/** HSV → "#RRGGBB"(대문자). */
function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g] = [c, x]
  else if (h < 120) [r, g] = [x, c]
  else if (h < 180) [g, b] = [c, x]
  else if (h < 240) [g, b] = [x, c]
  else if (h < 300) [r, b] = [x, c]
  else [r, b] = [c, x]
  const ch = (u: number) =>
    Math.round((u + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`.toUpperCase()
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** window.EyeDropper(지원 브라우저만) 최소 타입 — 미지원이면 undefined. */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }
function getEyeDropper(): EyeDropperCtor | undefined {
  return (globalThis as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
}

export interface EmotionColorPickerProps {
  /** 현재 색 "#RRGGBB". */
  value: string
  /** 이 감정의 추천색 "#RRGGBB"("추천으로 되돌리기" 대상). */
  recommended: string
  /** 색 변경 콜백 — 항상 정규화된 "#RRGGBB". */
  onChange: (hex: string) => void
  /** 접근성 라벨(감정 이름). */
  label: string
}

export function EmotionColorPicker({ value, recommended, onChange, label }: EmotionColorPickerProps) {
  // 내부 HSV 상태(hue/s/v) — hex만 들고 있으면 s·v=0에서 hue가 소실되므로 별도로 유지하고, value가
  // *밖에서* 바뀌면(감정 전환·추천 복귀·hex 입력) 다시 동기화한다(우리 드래그가 만든 변화면 그대로 둔다).
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue && value !== hsvToHex(hsv)) {
    setLastValue(value)
    setHsv(hexToHsv(value))
  }

  const [hexDraft, setHexDraft] = useState(value)
  const [lastHexValue, setLastHexValue] = useState(value)
  if (value !== lastHexValue) {
    setLastHexValue(value)
    setHexDraft(value)
  }

  const planeRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const eyeDropper = useMemo(() => getEyeDropper(), [])

  const emit = useCallback(
    (next: HSV) => {
      setHsv(next)
      const hex = hsvToHex(next)
      setLastValue(hex) // 우리 변화 — 위 동기화 가드가 다시 덮어쓰지 않게
      onChange(hex)
    },
    [onChange],
  )

  // SV 면: x=saturation, y=value(위가 밝음). pointer를 면 좌표로 환산.
  const pointToSv = useCallback((clientX: number, clientY: number) => {
    const el = planeRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { s: clamp01((clientX - r.left) / r.width), v: clamp01(1 - (clientY - r.top) / r.height) }
  }, [])

  const onPlanePointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0 && e.type === 'pointermove') return
      const sv = pointToSv(e.clientX, e.clientY)
      if (sv) emit({ ...hsv, ...sv })
    },
    [emit, hsv, pointToSv],
  )

  const onHuePointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0 && e.type === 'pointermove') return
      const el = hueRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      emit({ ...hsv, h: clamp01((e.clientX - r.left) / r.width) * 360 })
    },
    [emit, hsv],
  )

  const onPlaneKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.1 : 0.02
      let { s, v } = hsv
      if (e.key === 'ArrowRight') s += step
      else if (e.key === 'ArrowLeft') s -= step
      else if (e.key === 'ArrowUp') v += step
      else if (e.key === 'ArrowDown') v -= step
      else return
      e.preventDefault()
      emit({ ...hsv, s: clamp01(s), v: clamp01(v) })
    },
    [emit, hsv],
  )

  const onHueKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 24 : 4
      let h = hsv.h
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h += step
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h -= step
      else return
      e.preventDefault()
      emit({ ...hsv, h: (h + 360) % 360 })
    },
    [emit, hsv],
  )

  const commitHex = useCallback(() => {
    const norm = normalizeHex(hexDraft)
    if (norm) onChange(norm)
    else setHexDraft(value) // 형식 아니면 되돌림(비차단)
  }, [hexDraft, onChange, value])

  const pickWithEyeDropper = useCallback(() => {
    const Ctor = eyeDropper
    if (!Ctor) return
    new Ctor()
      .open()
      .then((res) => {
        const norm = normalizeHex(res.sRGBHex)
        if (norm) onChange(norm)
      })
      .catch(() => {
        /* 사용자가 취소 — 무시 */
      })
  }, [eyeDropper, onChange])

  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div className="flex flex-col gap-3">
      {/* saturation/value 면 — 좌우=채도, 상하=명도. 배경은 현재 hue. */}
      <div
        ref={planeRef}
        role="slider"
        aria-label={`${label} 채도·명도`}
        aria-valuetext={`채도 ${Math.round(hsv.s * 100)}%, 명도 ${Math.round(hsv.v * 100)}%`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          onPlanePointer(e)
        }}
        onPointerMove={onPlanePointer}
        onKeyDown={onPlaneKey}
        className="relative h-44 w-full touch-none rounded-2xl outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-white/70"
        style={{
          backgroundColor: hueHex,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <span
          aria-hidden
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
        />
      </div>

      {/* hue rail — 0..360. */}
      <div
        ref={hueRef}
        role="slider"
        aria-label={`${label} 색상(hue)`}
        aria-valuetext={`${Math.round(hsv.h)}도`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          onHuePointer(e)
        }}
        onPointerMove={onHuePointer}
        onKeyDown={onHueKey}
        className="relative h-5 w-full touch-none rounded-full outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-white/70"
        style={{
          backgroundImage:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueHex }}
        />
      </div>

      {/* hex 입력 + 추천 복귀 + (지원 시) eyedropper. */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-7 shrink-0 rounded-lg border border-white/15"
          style={{ backgroundColor: value }}
        />
        <input
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitHex()
          }}
          spellCheck={false}
          aria-label={`${label} hex 코드`}
          className="w-28 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-sm uppercase text-white/90 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        />
        {eyeDropper && (
          <button
            type="button"
            onClick={pickWithEyeDropper}
            aria-label="화면에서 색 추출"
            className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:text-white/95"
          >
            <Pipette className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(recommended)}
          disabled={value === recommended}
          aria-label="추천색으로 되돌리기"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition hover:text-white/95 disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" />
          추천
        </button>
      </div>
    </div>
  )
}

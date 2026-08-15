import { useMemo, type CSSProperties } from 'react'

import {
  EMOTION_LIGHTNESS_STEPS,
  clampChromaToGamut,
  maxChromaInGamut,
  nearestEmotionStep,
  okLchToColor,
  type OkLch,
} from '@cosimosi/emotion'
import { SegmentedControl } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// Enough stops to read as continuous, few enough to rebuild on every drag.
const HUE_STOPS = 24
const CHROMA_STOPS = 12

// Paired to EMOTION_LIGHTNESS_STEPS by index, which is already brightest-first, so this control
// cannot drift from the palette's table.
const LIGHTNESS_LABELS = [
  m.palette_lightness_light,
  m.palette_lightness_mid,
  m.palette_lightness_deep,
]

export interface MoodColorPickerProps {
  value: OkLch
  onChange: (lch: OkLch) => void
  disabled: boolean
}

/**
 * The free-choice half of the editor, on the three axes a stored colour keeps: hue, vividness, and
 * the lightness step. It is not an RGB square because lightness is server-snapped to three steps —
 * two of an RGB picker's dimensions would move a colour the save then undoes.
 *
 * Vividness is a fraction of what *this* hue and step can hold in sRGB, so the slider's far end is
 * the most colour that exists there instead of a stretch of positions that all clip to one hue.
 */
export function MoodColorPicker({ value, onChange, disabled }: MoodColorPickerProps) {
  const ceiling = useMemo(() => maxChromaInGamut(value.l, value.h), [value.l, value.h])
  const chromaFraction = ceiling === 0 ? 0 : value.c / ceiling

  const hueTrack = useMemo(
    () =>
      trackGradient(HUE_STOPS, (fraction) =>
        clampChromaToGamut({ l: value.l, c: value.c, h: fraction * 360 }),
      ),
    [value.l, value.c],
  )
  const chromaTrack = useMemo(
    () => trackGradient(CHROMA_STOPS, (fraction) => ({ ...value, c: fraction * ceiling })),
    [value, ceiling],
  )

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-text">{m.palette_picker_title()}</h3>
      <label className="flex flex-col gap-2">
        <span className="text-xs text-text-muted">{m.palette_picker_hue()}</span>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.min(359, Math.max(0, Math.round(value.h)))}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, h: Number(event.target.value) })}
          className={SLIDER}
          style={hueTrack}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs text-text-muted">{m.palette_picker_chroma()}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(chromaFraction * 100)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, c: (Number(event.target.value) / 100) * ceiling })
          }
          className={SLIDER}
          style={chromaTrack}
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-muted">{m.palette_picker_lightness()}</span>
        <SegmentedControl
          ariaLabel={m.palette_picker_lightness()}
          disabled={disabled}
          value={String(nearestEmotionStep(value.l))}
          onValueChange={(next) => onChange(clampChromaToGamut({ ...value, l: Number(next) }))}
          items={EMOTION_LIGHTNESS_STEPS.map((step, index) => ({
            value: String(step),
            label: (LIGHTNESS_LABELS[index] ?? LIGHTNESS_LABELS[0])(),
          }))}
        />
      </div>
    </section>
  )
}

// The track is the preview: every position is painted the colour it selects.
const SLIDER =
  'h-4 w-full cursor-pointer appearance-none rounded-full border border-border bg-transparent ' +
  'disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-focus-ring ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
  '[&::-webkit-slider-thumb]:border-text [&::-webkit-slider-thumb]:bg-surface ' +
  '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-text [&::-moz-range-thumb]:bg-surface'

function trackGradient(stops: number, at: (fraction: number) => OkLch): CSSProperties {
  const colors = Array.from({ length: stops + 1 }, (_, index) =>
    okLchToColor(at(index / stops)),
  ).join(', ')
  return { backgroundImage: `linear-gradient(to right, ${colors})` }
}

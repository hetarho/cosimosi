// Evolution timelapse (spec 24) — a 2D HUD overlay outside the R3F canvas (Architecture
// §3.1), opened from the recall panel's "변천사 보기". Reads the append-only log spec 23
// wrote (read-only; no edit path — constitution §1) and lets the user scrub a star's
// variants. Each version is re-rendered with the SAME VizStar (signature unchanged,
// acceptance 1.10): form = base seed + form_seed_delta, brightness, and a wrapper
// hue-rotate(hue_shift) — concept + emotion color stay fixed (same memory, a variant).
// Alongside sits the immutable original Record (spec 11, from cache), which never changes
// as the slider moves (1.4). The live universe canvas stays behind (we never leave it).
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Record as RecordMsg } from '@/shared/api'
import { moodFromProto, recordQueryKey, reshapedSeed, seedFromId } from '@/entities/memory'
import { VizStar } from '@/entities/star'
import { useAppearance } from '@/entities/appearance'
import { moodLabel, resolveMoodRgb, type RGB } from '@/shared/config'
import { evolutionQueryKey, getEvolutionHistory } from '../api/evolution'
import { clampIndex, toEvolutionSteps, useEvolutionStore } from '../model'

/** RGB tuple (0..1) → "#RRGGBB" for VizStar's hex color prop. */
function rgbToHex([r, g, b]: RGB): string {
  const h = (c: number) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Mount point: render the timelapse for the open star, else nothing. Keyed by id so a
 *  new star opens fresh (scrub index resets without a setState-in-effect). */
export function EvolutionPanel() {
  const openFor = useEvolutionStore((s) => s.openFor)
  if (!openFor) return null
  return <EvolutionView key={openFor} memoryId={openFor} />
}

function EvolutionView({ memoryId }: { memoryId: string }) {
  const concept = useAppearance((s) => s.object)
  const emotionColors = useAppearance((s) => s.emotionColors)
  const queryClient = useQueryClient()

  // The immutable original — reused from the recall cache (constitution §1; the viewer is
  // entered from the recall "shown" phase, so it's already cached). It never re-fetches and
  // never changes as the slider moves.
  const record = queryClient.getQueryData<RecordMsg>(recordQueryKey(memoryId)) ?? null

  const { data, isPending, isError } = useQuery({
    queryKey: evolutionQueryKey(memoryId),
    queryFn: () => getEvolutionHistory(memoryId),
  })
  const steps = useMemo(() => toEvolutionSteps(data ?? []), [data])

  // null = "not scrubbed yet" → open at the NEWEST version (the star's current look on the
  // real path; demo synthesizes an illustrative history); once they drag, the index sticks.
  const [scrubbed, setScrubbed] = useState<number | null>(null)
  const index = clampIndex(scrubbed ?? steps.length - 1, steps.length)
  const step = steps[index]

  const baseSeed = seedFromId(memoryId)
  const moodStr = record ? moodFromProto(record.mood) : 'neutral'
  const color = rgbToHex(resolveMoodRgb(moodStr, emotionColors))

  // Body-only (home-ia revamp): the page hosts this inside a Surface (place=center, width=lg),
  // which owns the container, title ("별 변천사 — 변한 것과 변하지 않은 것") and close (→ store close).
  return (
    <>
      {isPending && <p className="text-sm text-white/50">변천사를 불러오는 중…</p>}
      {isError && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ 변천사를 불러오지 못했어요.</p>
      )}

      {!isPending && !isError && steps.length === 0 && (
        <p className="text-sm text-white/55">아직 변천사가 없어요 — 최초 모습 그대로예요.</p>
      )}

      {!isPending && !isError && step && (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* 변하는 것 — 별의 변주 */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-space-800/40 p-4">
            <div
              className="relative size-36"
              style={{ filter: `hue-rotate(${step.hueShift}deg)`, transition: 'filter 0.4s ease' }}
              role="img"
              aria-label={`${step.version}번째 모습`}
            >
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                <VizStar
                  cx={50}
                  cy={50}
                  r={30}
                  color={color}
                  concept={concept}
                  seed={reshapedSeed(baseSeed, step.formSeedDelta)}
                  brightness={step.brightness}
                  active
                />
              </svg>
            </div>

            {/* 계기 라벨 + 강화/약화 */}
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/15 px-2 py-0.5">{step.triggerLabel}</span>
              {step.version === 0 ? (
                <span className="text-white/40">최초</span>
              ) : (
                <span className={step.dir >= 0 ? 'text-mood-teal/80' : 'text-mood-coral/80'}>
                  {step.dir >= 0 ? '강화 ↑' : '약화 ↓'} · {step.version}번째
                </span>
              )}
            </div>

            {/* 스크럽 슬라이더 */}
            {steps.length > 1 && (
              <input
                type="range"
                min={0}
                max={steps.length - 1}
                value={index}
                onChange={(e) => setScrubbed(Number(e.target.value))}
                aria-label="변천사 스크럽"
                className="w-full accent-mood-pink"
              />
            )}

            {/* 변천사 strip — 버전 썸네일(ReconsolidationCard 청사진) */}
            <div className="flex w-full items-end gap-2 overflow-x-auto pb-1">
              {steps.map((s, i) => (
                <button
                  key={s.version}
                  type="button"
                  onClick={() => setScrubbed(i)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition ${i === index ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  aria-label={`${s.version}번째 모습 보기`}
                >
                  <svg viewBox="0 0 100 100" className="size-9" style={{ filter: `hue-rotate(${s.hueShift}deg)` }}>
                    <VizStar
                      cx={50}
                      cy={50}
                      r={30}
                      color={color}
                      concept={concept}
                      seed={reshapedSeed(baseSeed, s.formSeedDelta)}
                      brightness={s.brightness}
                    />
                  </svg>
                  <span className="text-[10px] text-white/40">
                    {s.version === 0 ? '최초' : `${s.version}${s.dir >= 0 ? '↑' : '↓'}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 변하지 않는 것 — 불변 원본(슬라이더와 무관하게 고정, 헌법1) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-space-900/50 p-4">
            <span className="text-xs uppercase tracking-widest text-white/40">원본 · 바뀌지 않음</span>
            {record ? (
              // ph-no-capture: 일기 원문 — PostHog autocapture 차단(프라이버시 헌법; MemoryPanel과 동일).
              <article className="ph-no-capture flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <span>{record.entryDate}</span>
                  <span>·</span>
                  <span>{moodLabel(moodFromProto(record.mood))}</span>
                </div>
                <p className="selectable whitespace-pre-wrap text-sm leading-relaxed text-white/85">{record.body}</p>
              </article>
            ) : (
              <p className="text-sm text-white/45">원본은 회상 패널에서 먼저 열어주세요.</p>
            )}
            <p className="mt-auto text-xs leading-relaxed text-white/35">
              몇 번을 떠올려도, 그날 내가 쓴 이 문장은 그대로예요.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

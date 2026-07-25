import { useEffect, useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  PostFX,
  SKY_EFFECTS,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveSkyEffect,
  useSkin,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import {
  MAX_SHOWCASE_EMOTIONS,
  moodColor,
  MOODS,
  showcaseEmotions,
  toEmotionSlices,
  type EmotionSlice,
  type Mood,
} from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { useEpisodicMemoryStore, useNeuronStore, useSynapseStore } from '@cosimosi/universe'
import { CellStarLayer, FilamentLayer, NebulaField, StarLayer } from '@cosimosi/universe-render'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Switch,
  cx,
  useReducedMotion,
  type ControlSize,
} from '@cosimosi/ui'

import { buildEngramDemoScene, type EngramDemoScene } from './engram-demo-scene.ts'

/**
 * The live universe with real product chrome floating over it.
 *
 * This panel answers what only a running scene can: whether glass still reads when the thing behind
 * it is moving, and how the field responds as the universe's emotions shift. The 2D language itself
 * — tokens, the primitive catalogue, composed screens — is reviewed on the design showcase
 * (/design), which needs no GPU and no domain stores; keeping the two apart stops this surface from
 * drifting into a second, half-maintained component gallery.
 *
 * Captions are demo data, intentionally outside the product i18n catalogue (a dev-only surface).
 */

// Quick "how many emotions" presets — pick a count 1..N and the universe fills to that many emotions
// (geometrically descending shares); the sliders below still fine-tune each share afterwards.
const EMOTION_COUNTS = Array.from({ length: MAX_SHOWCASE_EMOTIONS }, (_, i) => i + 1)

// Human labels for the moods the demo scene uses (dev-only /test copy, not product i18n).
const MOOD_LABEL: Record<Mood, string> = {
  JOY: 'Joy',
  CALM: 'Calm',
  SAD: 'Sad',
  ANGER: 'Anger',
  FEAR: 'Fear',
  LOVE: 'Love',
  NEUTRAL: 'Neutral',
  EXCITEMENT: 'Excitement',
  GRATITUDE: 'Gratitude',
  RELIEF: 'Relief',
  STRESS: 'Stress',
  TIRED: 'Tired',
  EMPTINESS: 'Emptiness',
}

const T = {
  hud: '우주의 시간 · Y1 · D28',
  emotionCountLabel: 'How many emotions',
  emotionsTitle: 'Emotions in this universe',
  emotionsHint: 'Drag a share — the rest give or take to keep the total at 100%',
  addEmotion: 'Add an emotion',
  primaryTag: 'primary',
  backgroundTitle: 'Backdrop',
  cardSolid: 'Solid',
  cardGlass: 'Glass',
  demoStatus: 'Active',
  demoNotify: 'Notifications',
  demoRemember: 'Remember me',
  demoAction: 'Save',
  demoAlt: 'Cancel',
  modalOpen: 'Open dialog',
  dialogTitle: 'Release this star?',
  dialogBody: 'This memory will fade from the universe. You can’t undo this.',
  dialogClose: 'Close',
  dialogDontShow: 'Don’t ask again',
  dialogCancel: 'Cancel',
  dialogConfirm: 'Release',
}

export function UiTestPanel() {
  // The skin still tunes the scene's camera and bloom; the 2D theme is applied once at the app's
  // composition boundary, so nothing here touches `data-theme`.
  return (
    <SkinProvider defaultSkin="aurora">
      <UniversePanel />
    </SkinProvider>
  )
}

// The live 3D scene floating over an emotion-driven backdrop, with glass product UI on top.
// The backdrop carries the *emotions present in the universe* (1..13) as shares that always total
// 100%: dragging one emotion's share makes the rest give or take in proportion to their current
// shares, so the field stays a faithful pie of the universe's feeling. The more emotions present,
// the more finely the backdrop divides among them.
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function countMoods(memories: readonly EpisodicMemory[]): Map<Mood, number> {
  const counts = new Map<Mood, number>()
  for (const memory of memories) {
    counts.set(memory.emotion.mood, (counts.get(memory.emotion.mood) ?? 0) + 1)
  }
  return counts
}

function dominantMood(weights: ReadonlyMap<Mood, number>): Mood {
  let best: Mood = MOODS[0]
  let bestWeight = -1
  for (const mood of MOODS) {
    const weight = weights.get(mood) ?? 0
    if (weight > bestWeight) {
      best = mood
      bestWeight = weight
    }
  }
  return best
}

// Round fractional shares to whole percents that sum to exactly `targetSum` (largest-remainder
// method: floor everyone, then hand the leftover percents to the largest fractional parts).
function roundShares(
  shares: readonly (readonly [Mood, number])[],
  targetSum: number,
): [Mood, number][] {
  const parts = shares.map(([mood, value]) => {
    const floor = Math.floor(value)
    return { mood, floor, remainder: value - floor }
  })
  const used = parts.reduce((sum, part) => sum + part.floor, 0)
  let leftover = Math.round(targetSum) - used
  const ranked = [...parts].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < ranked.length && leftover > 0; i += 1) {
    ranked[i].floor += 1
    leftover -= 1
  }
  return parts.map((part) => [part.mood, part.floor] as [Mood, number])
}

// The universe's starting shares: each mood weighted by how many memories carry it, normalized to
// whole percents summing to 100. An empty universe falls back to a single mood at 100.
function initialWeights(memories: readonly EpisodicMemory[]): Map<Mood, number> {
  const counts = [...countMoods(memories)].filter(([, count]) => count > 0)
  if (counts.length === 0) return new Map([[MOODS[0], 100]])
  const total = counts.reduce((sum, [, count]) => sum + count, 0)
  const scaled = counts.map(([mood, count]) => [mood, (count / total) * 100] as const)
  const weights = new Map<Mood, number>()
  for (const [mood, percent] of roundShares(scaled, 100))
    if (percent > 0) weights.set(mood, percent)
  return weights
}

// Set `mood` to `rawTarget`% and let the other present emotions absorb the difference in proportion
// to their current shares, keeping the total at 100. Guards match the spec: a lone emotion (nothing
// else present) can't be moved — it's stuck at 100 — and a zero emotion never grows from
// redistribution (only an explicit add brings one in). Increasing caps the mood at 100 as the
// others reach 0.
function setWeight(
  weights: ReadonlyMap<Mood, number>,
  mood: Mood,
  rawTarget: number,
): Map<Mood, number> {
  const current = weights.get(mood) ?? 0
  const others = [...weights].filter(([other, weight]) => other !== mood && weight > 0)
  const othersTotal = others.reduce((sum, [, weight]) => sum + weight, 0)
  if (othersTotal <= 0) return new Map(weights)
  const target = Math.round(clamp(rawTarget, 0, 100))
  // Can't take more than the others hold (mood caps at 100) or push the mood below 0.
  const moved = clamp(target - current, -current, othersTotal)
  if (moved === 0) return new Map(weights)
  const settled = current + moved
  const shares = others.map(
    ([other, weight]) => [other, weight - moved * (weight / othersTotal)] as const,
  )
  const next = new Map<Mood, number>()
  for (const [other, percent] of roundShares(shares, 100 - settled))
    if (percent > 0) next.set(other, percent)
  if (settled > 0) next.set(mood, settled)
  return next
}

function UniversePanel() {
  const scene = useMemo(() => buildEngramDemoScene(), [])
  const [weights, setWeights] = useState<ReadonlyMap<Mood, number>>(() =>
    initialWeights(scene.memories),
  )
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(SKY_EFFECTS[0].key)

  const emotions = useMemo(() => toEmotionSlices(weights), [weights])
  const primary = useMemo(() => dominantMood(weights), [weights])
  const effect = resolveSkyEffect(effectKey)

  // Drag a slider to set a mood's share; the rest of the universe absorbs the change in proportion
  // to their current shares, so every emotion always totals 100. Adding pulls a slice from the rest.
  const handleSet = (mood: Mood, value: number) =>
    setWeights((current) => setWeight(current, mood, value))
  const handleAdd = (mood: Mood) =>
    setWeights((current) => setWeight(current, mood, Math.round(100 / (current.size + 1))))
  // Pick a count → fill the universe with that many emotions on geometrically descending shares (the
  // same showcase distribution the sliders below then fine-tune).
  const handleCount = (n: number) =>
    setWeights(() => {
      const next = new Map<Mood, number>()
      for (const [mood, percent] of roundShares(
        showcaseEmotions(n).map((slice) => [slice.mood, slice.weight * 100] as const),
        100,
      ))
        if (percent > 0) next.set(mood, percent)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <EmotionCountPresets count={emotions.length} onPick={handleCount} />
      <EmotionControls weights={weights} primary={primary} onSet={handleSet} onAdd={handleAdd} />
      <BackgroundSwitcher activeKey={effect.key} onSelect={setEffectKey} />

      {/* The emotion sky is now a real body INSIDE the scene (the enclosing sphere), not a DOM layer
          behind a transparent canvas: 3D universe (z-0) · glass chrome (z-10). */}
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="absolute inset-0 z-0">
          <EngramUniverseCanvas scene={scene} effect={effect.key} emotions={emotions} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="neutral" data-on-scene>
              {T.hud}
            </Badge>
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="glass-subtle rounded-full px-3 py-1 text-xs text-text-muted">
                {effect.label}
              </span>
              <DialogDemo size="sm" />
            </div>
          </div>
          {/* glass vs solid, both floating over the same live universe: the glass card frosts the
              scene behind it, the solid card is opaque — the clearest way to feel the difference. */}
          <div className="pointer-events-auto grid grid-cols-2 gap-3">
            <DemoCard variant="glass" />
            <DemoCard variant="solid" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Quick emotion-count presets: one button per count 1..N. Picking a count fills the universe with
// that many emotions (the showcase distribution); the sliders below still fine-tune each share.

function EmotionCountPresets({ count, onPick }: { count: number; onPick: (n: number) => void }) {
  return (
    <section className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
        {T.emotionCountLabel}
      </span>
      {EMOTION_COUNTS.map((n) => {
        const selected = n === count
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-pressed={selected}
            className={cx(
              'inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors',
              selected
                ? 'border-primary text-text'
                : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
            )}
          >
            {n}
          </button>
        )
      })}
    </section>
  )
}

// The present-emotions control: one slider per present emotion showing its share of the field (all
// shares total 100%, shown on the right). Dragging a slider redistributes the rest proportionally;
// the largest share is tagged `primary`. Absent moods sit below as faded chips that add themselves
// (pulling a slice from the rest). A lone emotion (the only one present, so at 100%) locks — there
// is nothing to trade its share with.
function EmotionControls({
  weights,
  primary,
  onSet,
  onAdd,
}: {
  weights: ReadonlyMap<Mood, number>
  primary: Mood
  onSet: (mood: Mood, value: number) => void
  onAdd: (mood: Mood) => void
}) {
  const present = MOODS.filter((mood) => (weights.get(mood) ?? 0) > 0)
  const absent = MOODS.filter((mood) => (weights.get(mood) ?? 0) <= 0)
  // With a single emotion present it holds the whole 100% and has no partner to give to or take
  // from — its slider and remove control lock (spec: "can't reduce the lone 100").
  const locked = present.length <= 1

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
          {T.emotionsTitle} · {present.length}
        </h3>
        <span className="text-xs text-text-subtle">{T.emotionsHint}</span>
      </div>

      <div className="flex flex-col gap-2">
        {present.map((mood) => {
          const value = weights.get(mood) ?? 0
          const color = moodColor(mood)
          const isPrimary = mood === primary
          return (
            <div key={mood} className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs font-medium text-text">
                <span className="truncate">{MOOD_LABEL[mood]}</span>
                {isPrimary ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
                    {T.primaryTag}
                  </span>
                ) : null}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                disabled={locked}
                aria-label={`${MOOD_LABEL[mood]} share`}
                onChange={(event) => onSet(mood, event.target.valueAsNumber)}
                className="min-w-0 flex-1 disabled:opacity-40"
                style={{ accentColor: color }}
              />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-text-muted">
                {value}%
              </span>
              <button
                type="button"
                onClick={() => onSet(mood, 0)}
                disabled={locked}
                aria-label={`Remove ${MOOD_LABEL[mood]}`}
                className="shrink-0 rounded-full px-1.5 text-sm text-text-subtle transition-colors hover:text-text disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {absent.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-text-subtle">{T.addEmotion}</span>
          <div className="flex flex-wrap gap-2">
            {absent.map((mood) => {
              const color = moodColor(mood)
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => onAdd(mood)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-text-subtle opacity-60 transition-opacity hover:opacity-100"
                >
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {MOOD_LABEL[mood]}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

// The emotion-sky switcher: one button per react-bits-derived effect (a live WebGPU thumbnail each
// would cost a context, so it's labels not previews) plus the selected one's blurb. Selecting swaps
// the sky enclosing the live universe above.
function BackgroundSwitcher({
  activeKey,
  onSelect,
}: {
  activeKey: SkyEffectKey
  onSelect: (key: SkyEffectKey) => void
}) {
  const active = resolveSkyEffect(activeKey)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
        {T.backgroundTitle}
      </h3>
      <div className="flex flex-wrap gap-2">
        {SKY_EFFECTS.map((entry) => {
          const selected = entry.key === active.key
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => onSelect(entry.key)}
              aria-pressed={selected}
              title={entry.blurb}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-primary text-text'
                  : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'size-1.5 rounded-full',
                  entry.fidelity === 'faithful' ? 'bg-primary' : 'bg-text-subtle',
                )}
              />
              {entry.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-text-subtle">{active.blurb}</p>
    </section>
  )
}

// A self-contained slice of the product universe for design work: it loads a fixed set of engram
// cells (8 episodic memories anchored to a handful of neurons) into the shared read-model stores
// and renders the real render layers over a static coordinate buffer — no force-sim, no backend.
// So the memory stars, cell-star neurons, synapse filaments, and emotion nebula all draw from
// genuine domain facts. The emotion sky is a real body enclosing the scene (the BackSide sphere),
// shaded by the chosen react-bits effect off the universe's palette. The skin still tunes camera +
// bloom.
function EngramUniverseCanvas({
  scene,
  effect,
  emotions,
}: {
  scene: EngramDemoScene
  effect: SkyEffectKey
  emotions: readonly EmotionSlice[]
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const positions = useMemo(() => ({ current: scene.positions }), [scene])

  // Own the singleton read-model stores while mounted — the product universe widget is never
  // mounted on the /test surface — and clear them on unmount so a later panel starts clean.
  useEffect(() => {
    useNeuronStore.getState().setAll(scene.neurons)
    useEpisodicMemoryStore.getState().setAll(scene.memories)
    useSynapseStore.getState().setAll(scene.synapses)
    return () => {
      useNeuronStore.getState().setAll([])
      useEpisodicMemoryStore.getState().setAll([])
      useSynapseStore.getState().setAll([])
    }
  }, [scene])

  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <SkySphere stops={emotions} effect={effect} reducedMotion={reducedMotion} />
      <StarField reducedMotion={reducedMotion} />
      <NebulaField positions={positions} firstNodeIndex={scene.firstMemoryIndex} />
      <CellStarLayer positions={positions} />
      <StarLayer
        positions={positions}
        firstNodeIndex={scene.firstMemoryIndex}
        universeTime={scene.universeTime}
      />
      <FilamentLayer
        positions={positions}
        neuronIndexById={scene.neuronIndexById}
        universeTime={scene.universeTime}
      />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

// The design-system Dialog over the live scene — the one overlay whose scrim and glass have to be
// judged against a moving background rather than a flat page.

function DialogDemo({ size = 'md' }: { size?: ControlSize }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        {T.modalOpen}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={T.dialogTitle}
        description={T.dialogBody}
        closeLabel={T.dialogClose}
      >
        <div className="flex flex-col gap-4">
          <Checkbox label={T.dialogDontShow} />
          <div className="flex justify-end gap-2">
            <Button variant="text" color="neutral" onClick={() => setOpen(false)}>
              {T.dialogCancel}
            </Button>
            <Button color="danger" onClick={() => setOpen(false)}>
              {T.dialogConfirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

// A card filled with real controls, in both surface variants — the clearest way to see the
// glass↔solid difference: over the universe the glass card frosts the scene through it while the
// solid card stays opaque.
function DemoCard({ variant }: { variant: 'solid' | 'glass' }) {
  const [notify, setNotify] = useState(variant === 'glass')
  const [remember, setRemember] = useState(true)
  const label = variant === 'glass' ? T.cardGlass : T.cardSolid
  return (
    <Card variant={variant} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <Badge variant={variant === 'glass' ? 'primary' : 'success'}>{T.demoStatus}</Badge>
      </div>
      <Switch label={T.demoNotify} checked={notify} onCheckedChange={setNotify} />
      <Checkbox label={T.demoRemember} checked={remember} onCheckedChange={setRemember} />
      <div className="flex gap-2">
        <Button size="sm">{T.demoAction}</Button>
        <Button size="sm" variant="text" color="neutral">
          {T.demoAlt}
        </Button>
      </div>
    </Card>
  )
}

// Side-by-side glass vs solid, used on the UI-only page (plain surface) and the Design-system tab.

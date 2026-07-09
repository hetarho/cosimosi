import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

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
  type SkinKey,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import { moodColor, MOODS, type Mood } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { useEpisodicMemoryStore, useNeuronStore, useSynapseStore } from '@cosimosi/universe'
import { CellStarLayer, FilamentLayer, NebulaField, StarLayer } from '@cosimosi/universe-render'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  IconButton,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  cx,
  useReducedMotion,
  type BadgeVariant,
  type ButtonVariant,
  type ButtonColor,
  type ControlSize,
} from '@cosimosi/ui'

import { toEmotionSlices, type EmotionSlice } from './emotion-slices.ts'
import { buildEngramDemoScene, type EngramDemoScene } from './engram-demo-scene.ts'

// The single UI test surface, split into three tabs that share one skin. A preset is a
// *universe*: one switch drives the 3D skin and the 2D theme together (data-theme on the
// document root re-skins portals too), so every tab re-skins at once. Captions are demo data,
// intentionally outside the product i18n catalog (a dev-only /test surface).
const PRESETS: readonly { key: SkinKey; label: string; blurb: string }[] = [
  { key: 'aurora', label: 'Aurora', blurb: 'Cool borealis — lavender · chartreuse · mint.' },
  { key: 'ember', label: 'Ember', blurb: 'Warm cosmic — ember-coral · rose · gold.' },
]

const TABS = [
  { key: 'universe', label: 'Universe + UI' },
  { key: 'ui', label: 'UI only' },
  { key: 'system', label: 'Design system' },
] as const
type TabKey = (typeof TABS)[number]['key']

// Buttons are two axes now: appearance (contained/outlined/text) × colour. The matrix shows each
// appearance as a row across every colour.
const BUTTON_APPEARANCES: readonly { variant: ButtonVariant; label: string }[] = [
  { variant: 'contained', label: 'Contained' },
  { variant: 'outlined', label: 'Outlined' },
  { variant: 'text', label: 'Text' },
]
const BUTTON_COLORS: readonly ButtonColor[] = [
  'primary',
  'secondary',
  'tertiary',
  'neutral',
  'danger',
]
const CONTROL_SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
const BADGE_VARIANTS: readonly BadgeVariant[] = [
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
]

const ACCENTS: readonly { name: string; bg: string; fg: string }[] = [
  { name: 'Primary', bg: 'bg-primary', fg: 'text-primary-foreground' },
  { name: 'Secondary', bg: 'bg-secondary', fg: 'text-secondary-foreground' },
  { name: 'Tertiary', bg: 'bg-tertiary', fg: 'text-tertiary-foreground' },
]

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

// Presentation-only excerpts keyed by the demo memory id — episodic bodies are not part of the
// universe read model, so these live with the view, not the domain scene.
const SNIPPETS: Record<string, string> = {
  'm-window':
    'Rain against the glass, a page left open to the same line. Nothing asked to be finished.',
  'm-dusk-kitchen':
    'Onions in the pan, the radio low. She hummed the part she never remembered the words to.',
  'm-cat-home': 'Three days of an empty bowl, then paw prints on the sill at dawn.',
  'm-winter-sea': 'The water was the colour of old coins. We did not say much on the way back.',
  'm-cold-coffee':
    'Made it, forgot it, found it cold by the window. Poured it out without tasting.',
  'm-laughing-rain': 'We ran for the awning and missed it entirely — soaked, laughing at nothing.',
  'm-unsent-letter': 'Wrote it twice, folded it once, left it in the drawer with the others.',
  'm-morning-light':
    'First light on the counter, the whole day still unspent. Just the cup, warm in both hands.',
}

const T = {
  // Tabs
  tablistLabel: 'UI test views',
  // Universe overlay
  hud: '우주의 시간 · Y1 · D28',
  overlayCardTitle: 'A quiet afternoon',
  overlayCardBody: 'A surface floating over the live universe.',
  recall: '회고하기',
  history: '변천사',
  write: 'Write a diary',
  // Universe backdrop controls
  emotionsTitle: 'Emotions in this universe',
  emotionsHint: 'Drag a share — the rest give or take to keep the total at 100%',
  addEmotion: 'Add an emotion',
  primaryTag: 'primary',
  backgroundTitle: 'Backdrop',
  // Diary list (UI only)
  diaryTitle: 'Diary',
  universeCrumb: 'Universe',
  searchPlaceholder: 'Search memories',
  searchLabel: 'Search memories',
  sortRecent: 'Recent',
  sortStrongest: 'Strongest',
  back: 'Back',
  more: 'More',
  memories: 'memories',
  strength: 'Strength',
  notRecalled: 'Not yet recalled',
  // Component catalog (Design system)
  buttonsMatrix: 'Buttons · appearance × colour',
  sizesLabel: 'Sizes',
  buttonsStates: 'Buttons · states',
  iconButtons: 'Icon buttons',
  badges: 'Badges',
  fields: 'Fields',
  toggles: 'Toggles',
  overlays: 'Overlays',
  loading: 'Loading — skeleton',
  accentsTitle: 'Brand accents',
  cards: 'Cards',
  cardSolid: 'Solid',
  cardSolidBody: 'Elevated opaque content surface — lists, panels, forms.',
  cardGlass: 'Glass',
  cardGlassBody: 'Frosted material for chrome floating over the universe.',
  leadingIcon: 'leading icon',
  trailingIcon: 'trailing icon',
  loadingButton: 'loading',
  disabledButton: 'disabled',
  dangerDisabled: 'danger disabled',
  loadingIconAction: 'loading icon action',
  fieldLabel: 'Label',
  placeholder: 'Placeholder',
  fieldWithDescription: 'With description',
  fieldDescription: 'Helper text under the field.',
  fieldInvalid: 'Invalid',
  fieldError: 'This field is required.',
  fieldDisabled: 'Disabled',
  textArea: 'Text area',
  textAreaPlaceholder: 'Multi-line input',
  switchLabel: 'Switch',
  switchDisabled: 'Disabled',
  checkboxLabel: 'Checkbox',
  checkboxDisabled: 'Disabled',
  tooltipContent: 'I am a tooltip',
  tooltipTrigger: 'Hover for tooltip',
  showToast: 'Show toast',
  toastBody: 'Saved — this is a toast.',
  // Card comparison + demo card contents
  cardsCompare: 'Cards · glass vs solid',
  cardsCompareHint: 'Glass shows the scene through it; solid stays opaque',
  demoStatus: 'Active',
  demoNotify: 'Notifications',
  demoRemember: 'Remember me',
  demoAction: 'Save',
  demoAlt: 'Cancel',
  // Modal / Dialog
  modal: 'Modal / Dialog',
  modalOpen: 'Open dialog',
  dialogTitle: 'Release this star?',
  dialogBody: 'This memory will fade from the universe. You can’t undo this.',
  dialogClose: 'Close',
  dialogDontShow: 'Don’t ask again',
  dialogCancel: 'Cancel',
  dialogConfirm: 'Release',
}

const TABPANEL_ID = 'ui-test-tabpanel'

function UiTestInner() {
  const { skinKey, setSkinKey } = useSkin()
  const [tab, setTab] = useState<TabKey>('universe')
  const scene = useMemo(() => buildEngramDemoScene(), [])

  // WAI-ARIA tabs pattern: arrow/Home/End move between tabs with automatic activation, and only
  // the selected tab is in the Tab sequence (roving tabindex, set on each tab below).
  const handleTablistKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((entry) => entry.key === tab)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    if (next === null) return
    event.preventDefault()
    const nextKey = TABS[next].key
    setTab(nextKey)
    document.getElementById(`ui-test-tab-${nextKey}`)?.focus()
  }

  // Theme the whole document (portals included) while this panel is mounted; restore on leave.
  useEffect(() => {
    const el = document.documentElement
    const previous = el.getAttribute('data-theme')
    el.setAttribute('data-theme', skinKey)
    return () => {
      if (previous === null) el.removeAttribute('data-theme')
      else el.setAttribute('data-theme', previous)
    }
  }, [skinKey])

  return (
    <div className="flex flex-col gap-6 text-text">
      <div className="flex flex-wrap items-center gap-3">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            color={preset.key === skinKey ? 'primary' : 'neutral'}
            onClick={() => setSkinKey(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
        <span className="text-sm text-text-muted">
          {PRESETS.find((p) => p.key === skinKey)?.blurb}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={T.tablistLabel}
        onKeyDown={handleTablistKeyDown}
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {TABS.map((entry) => {
          const active = entry.key === tab
          return (
            <Button
              key={entry.key}
              role="tab"
              id={`ui-test-tab-${entry.key}`}
              aria-selected={active}
              aria-controls={TABPANEL_ID}
              tabIndex={active ? 0 : -1}
              variant={active ? 'contained' : 'text'}
              color={active ? 'primary' : 'neutral'}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </Button>
          )
        })}
      </div>

      <div
        id={TABPANEL_ID}
        role="tabpanel"
        aria-labelledby={`ui-test-tab-${tab}`}
        tabIndex={0}
        className="rounded-md"
      >
        {tab === 'universe' ? <UniverseTabPanel scene={scene} /> : null}
        {tab === 'ui' ? (
          <div className="flex flex-col gap-6">
            <CardComparison />
            <DiaryListScreen memories={scene.memories} />
          </div>
        ) : null}
        {tab === 'system' ? <ComponentCatalog /> : null}
      </div>
    </div>
  )
}

export function UiTestPanel() {
  return (
    <SkinProvider defaultSkin="aurora">
      <UiTestInner />
    </SkinProvider>
  )
}

// ── Universe + UI ──────────────────────────────────────────────────────────
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

function UniverseTabPanel({ scene }: { scene: EngramDemoScene }) {
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

  return (
    <div className="flex flex-col gap-4">
      <EmotionControls weights={weights} primary={primary} onSet={handleSet} onAdd={handleAdd} />
      <BackgroundSwitcher activeKey={effect.key} onSelect={setEffectKey} />

      {/* The emotion sky is now a real body INSIDE the scene (the enclosing sphere), not a DOM layer
          behind a transparent canvas: 3D universe (z-0) · glass chrome (z-10). */}
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-black/50">
        <div className="absolute inset-0 z-0">
          <EngramUniverseCanvas scene={scene} effect={effect.key} emotions={emotions} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="neutral">{T.hud}</Badge>
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
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
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
  // mounted on the /test surface — and clear them on unmount so a later tab starts clean.
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
      <StarField />
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

// Opens the design-system Dialog (glass-strong, portalled over a scrim). Dropped into each tab so
// the modal can be seen over the universe, over the diary page, and in the catalog — it always
// renders full-viewport over the current tab regardless of where its trigger lives.
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
// solid card stays opaque; on a plain page the glass reads as a lighter translucent panel.
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
function CardComparison() {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {T.cardsCompare}
          </h3>
          <span className="text-xs text-text-subtle">{T.cardsCompareHint}</span>
        </div>
        <DialogDemo size="sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DemoCard variant="glass" />
        <DemoCard variant="solid" />
      </div>
    </section>
  )
}

// ── UI only ────────────────────────────────────────────────────────────────
// A composed diary-list product screen, built entirely from design-system primitives over the
// same demo memories the universe draws — so the 2D list and the 3D scene stay one dataset.
function DiaryListScreen({ memories }: { memories: readonly EpisodicMemory[] }) {
  const ordered = useMemo(
    () => [...memories].sort((a, b) => b.createdUniverseTime.localeCompare(a.createdUniverseTime)),
    [memories],
  )
  return (
    <div className="card-surface overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="text" color="neutral" label={T.back} icon={<Chevron />} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text">{T.diaryTitle}</span>
            <span className="text-xs text-text-subtle">
              {`${ordered.length} ${T.memories} · ${T.universeCrumb}`}
            </span>
          </div>
        </div>
        <Button leadingIcon={<StarIcon />}>{T.write}</Button>
      </header>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <TextField aria-label={T.searchLabel} placeholder={T.searchPlaceholder} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary">{T.sortRecent}</Badge>
            <Badge variant="neutral">{T.sortStrongest}</Badge>
          </div>
        </div>
        <div className="grid max-h-120 gap-3 overflow-y-auto pr-1">
          {ordered.map((memory) => (
            <DiaryCard key={memory.id} memory={memory} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DiaryCard({ memory }: { memory: EpisodicMemory }) {
  return (
    <article className="card-surface flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <MoodTag mood={memory.emotion.mood} />
            <Badge variant="neutral">{formatUniverseDay(memory.createdUniverseTime)}</Badge>
          </div>
          <h4 className="truncate text-base font-semibold text-text">{memory.name}</h4>
        </div>
        <IconButton
          size="sm"
          variant="text"
          color="neutral"
          label={T.more}
          icon={<EllipsisIcon />}
        />
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-text-muted">{SNIPPETS[memory.id] ?? ''}</p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-xs text-text-subtle">{recalledLabel(memory)}</span>
        <StrengthMeter value={memory.baseStrength} />
      </div>
    </article>
  )
}

function MoodTag({ mood }: { mood: Mood }) {
  return (
    <Badge variant="neutral">
      <span aria-hidden className="badge-dot" style={{ backgroundColor: moodColor(mood) }} />
      {MOOD_LABEL[mood]}
    </Badge>
  )
}

function StrengthMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-subtle">{T.strength}</span>
      <div
        role="progressbar"
        aria-label={T.strength}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function formatUniverseDay(iso: string): string {
  const day = Number.parseInt(iso.slice(8, 10), 10)
  return Number.isFinite(day) ? `Y1 · D${day}` : iso
}

function recalledLabel(memory: EpisodicMemory): string {
  if (memory.recallCount === 0) return T.notRecalled
  const last = memory.lastRecalledUniverseTime
  const times = `Recalled ${memory.recallCount}×`
  return last ? `${times} · last ${formatUniverseDay(last)}` : times
}

// ── Design system ────────────────────────────────────────────────────────────
// The raw primitive catalog — every component in its variant/size/state matrix.
function ComponentCatalog() {
  const [toastOpen, setToastOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(false)
  const [checked, setChecked] = useState(true)

  return (
    <div className="flex flex-col gap-6">
      <Section title={T.accentsTitle}>
        <div className="grid gap-3 sm:grid-cols-3">
          {ACCENTS.map((a) => (
            <div
              key={a.name}
              className={`flex h-14 items-center justify-center rounded-md text-sm font-semibold ${a.bg} ${a.fg}`}
            >
              {a.name}
            </div>
          ))}
        </div>
      </Section>

      <Section title={T.cards}>
        <div className="grid gap-4 sm:grid-cols-2">
          <DemoCard variant="glass" />
          <DemoCard variant="solid" />
        </div>
      </Section>

      <Section title={T.modal}>
        <DialogDemo />
      </Section>

      <Section title={T.buttonsMatrix}>
        <div className="grid gap-4">
          {BUTTON_APPEARANCES.map((appr) => (
            <div key={appr.variant} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-xs uppercase tracking-wide text-text-subtle">
                {appr.label}
              </span>
              {BUTTON_COLORS.map((c) => (
                <Button key={c} variant={appr.variant} color={c}>
                  {c}
                </Button>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="w-24 text-xs uppercase tracking-wide text-text-subtle">
              {T.sizesLabel}
            </span>
            {CONTROL_SIZES.map((size) => (
              <Button key={size} size={size}>
                {size}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={T.buttonsStates}>
        <div className="flex flex-wrap items-center gap-3">
          <Button leadingIcon={<StarIcon />}>{T.leadingIcon}</Button>
          <Button trailingIcon={<StarIcon />} color="neutral">
            {T.trailingIcon}
          </Button>
          <Button loading>{T.loadingButton}</Button>
          <Button disabled>{T.disabledButton}</Button>
          <Button color="danger" disabled>
            {T.dangerDisabled}
          </Button>
        </div>
      </Section>

      <Section title={T.iconButtons}>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_COLORS.map((c) => (
            <IconButton
              key={c}
              variant="contained"
              color={c}
              label={`${c} icon action`}
              icon={<StarIcon />}
            />
          ))}
          <IconButton label={T.loadingIconAction} loading icon={<StarIcon />} />
        </div>
      </Section>

      <Section title={T.badges}>
        <div className="flex flex-wrap items-center gap-3">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title={T.fields}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={T.fieldLabel} placeholder={T.placeholder} />
          <TextField
            label={T.fieldWithDescription}
            description={T.fieldDescription}
            placeholder={T.placeholder}
          />
          <TextField label={T.fieldInvalid} error={T.fieldError} placeholder={T.placeholder} />
          <TextField label={T.fieldDisabled} placeholder={T.placeholder} disabled />
          <TextArea label={T.textArea} placeholder={T.textAreaPlaceholder} rows={3} />
        </div>
      </Section>

      <Section title={T.toggles}>
        <div className="flex flex-wrap items-center gap-6">
          <Switch label={T.switchLabel} checked={switchOn} onCheckedChange={setSwitchOn} />
          <Switch label={T.switchDisabled} checked={false} disabled />
          <Checkbox label={T.checkboxLabel} checked={checked} onCheckedChange={setChecked} />
          <Checkbox label={T.checkboxDisabled} checked={false} disabled />
        </div>
      </Section>

      <Section title={T.overlays}>
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content={T.tooltipContent}>
            <Button color="neutral">{T.tooltipTrigger}</Button>
          </Tooltip>
          <Button onClick={() => setToastOpen(true)}>{T.showToast}</Button>
          <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" durationMs={2400}>
            {T.toastBody}
          </Toast>
        </div>
      </Section>

      <Section title={T.loading}>
        <div className="grid max-w-sm gap-2">
          <Skeleton width="100%" height={16} />
          <Skeleton width="80%" height={16} />
          <Skeleton width="60%" height={16} />
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{title}</h3>
      <Card>{children}</Card>
    </section>
  )
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
      <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 14.9l-5.2 2.72.99-5.8L1.58 7.62l5.82-.85L10 1.5z" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EllipsisIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  )
}

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  PostFX,
  SkinProvider,
  StarField,
  UniverseCanvas,
  useSkin,
  type SkinKey,
} from '@cosimosi/3d-renderer'
import { moodColor, MOODS, type Mood } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { useEpisodicMemoryStore, useNeuronStore, useSynapseStore } from '@cosimosi/universe'
import { CellStarLayer, FilamentLayer, NebulaField, StarLayer } from '@cosimosi/universe-render'
import {
  Badge,
  Button,
  Checkbox,
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
  type ControlSize,
} from '@cosimosi/ui'

import { BACKGROUND_CANDIDATES } from './backgrounds/index.ts'
import { rgba, toEmotionSlices, type EmotionSlice } from './backgrounds/emotion-field.ts'
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

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const CONTROL_SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
const BADGE_VARIANTS: readonly BadgeVariant[] = ['neutral', 'primary', 'success', 'warning', 'danger']

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
  'm-window': 'Rain against the glass, a page left open to the same line. Nothing asked to be finished.',
  'm-dusk-kitchen': 'Onions in the pan, the radio low. She hummed the part she never remembered the words to.',
  'm-cat-home': 'Three days of an empty bowl, then paw prints on the sill at dawn.',
  'm-winter-sea': 'The water was the colour of old coins. We did not say much on the way back.',
  'm-cold-coffee': 'Made it, forgot it, found it cold by the window. Poured it out without tasting.',
  'm-laughing-rain': 'We ran for the awning and missed it entirely — soaked, laughing at nothing.',
  'm-unsent-letter': 'Wrote it twice, folded it once, left it in the drawer with the others.',
  'm-morning-light': 'First light on the counter, the whole day still unspent. Just the cup, warm in both hands.',
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
  emotionsHint: 'Tap a mood: add → make primary → remove',
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
  buttonsMatrix: 'Buttons · variants × sizes',
  buttonsStates: 'Buttons · states',
  iconButtons: 'Icon buttons',
  badges: 'Badges',
  fields: 'Fields',
  toggles: 'Toggles',
  overlays: 'Overlays',
  loading: 'Loading — skeleton',
  accentsTitle: 'Brand accents',
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
            variant={preset.key === skinKey ? 'primary' : 'secondary'}
            onClick={() => setSkinKey(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
        <span className="text-sm text-text-muted">{PRESETS.find((p) => p.key === skinKey)?.blurb}</span>
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
              variant={active ? 'primary' : 'ghost'}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </Button>
          )
        })}
      </div>

      <div id={TABPANEL_ID} role="tabpanel" aria-labelledby={`ui-test-tab-${tab}`} tabIndex={0} className="rounded-md">
        {tab === 'universe' ? <UniverseTabPanel scene={scene} /> : null}
        {tab === 'ui' ? <DiaryListScreen memories={scene.memories} /> : null}
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
// The backdrop is no longer tied to the theme — it carries the *emotions present in the universe*
// (1..13), so the controls below drive which emotions colour the field and which backdrop paints
// them. Weighting: each present mood counts 1, the primary counts more, so it reads as dominant;
// normalized so a fuller universe divides the field into more, evenly-shared slices.
const PRIMARY_BOOST = 2.5

function countMoods(memories: readonly EpisodicMemory[]): Map<Mood, number> {
  const counts = new Map<Mood, number>()
  for (const memory of memories) {
    counts.set(memory.emotion.mood, (counts.get(memory.emotion.mood) ?? 0) + 1)
  }
  return counts
}

function dominantMood(counts: ReadonlyMap<Mood, number>): Mood {
  let best: Mood = MOODS[0]
  let bestCount = -1
  for (const mood of MOODS) {
    const count = counts.get(mood) ?? 0
    if (count > bestCount) {
      best = mood
      bestCount = count
    }
  }
  return best
}

function buildEmotions(present: ReadonlySet<Mood>, primary: Mood): EmotionSlice[] {
  const raw = new Map<Mood, number>()
  for (const mood of present) raw.set(mood, mood === primary ? PRIMARY_BOOST : 1)
  if (raw.size === 0) raw.set(primary, PRIMARY_BOOST)
  return toEmotionSlices(raw)
}

function UniverseTabPanel({ scene }: { scene: EngramDemoScene }) {
  const reducedMotion = useReducedMotion()
  const sceneCounts = useMemo(() => countMoods(scene.memories), [scene])
  const [present, setPresent] = useState<ReadonlySet<Mood>>(() => new Set(sceneCounts.keys()))
  const [primary, setPrimary] = useState<Mood>(() => dominantMood(sceneCounts))
  const [candidateKey, setCandidateKey] = useState(BACKGROUND_CANDIDATES[0].key)

  const emotions = useMemo(() => buildEmotions(present, primary), [present, primary])
  const candidate = BACKGROUND_CANDIDATES.find((entry) => entry.key === candidateKey) ?? BACKGROUND_CANDIDATES[0]
  const Backdrop = candidate.Component

  // One tap cycles a mood: absent → present → primary → removed. Always keeps ≥1 present; removing
  // the primary hands the crown to the next remaining mood so the field is never orphaned.
  const cycleMood = (mood: Mood) => {
    if (!present.has(mood)) {
      const next = new Set(present)
      next.add(mood)
      setPresent(next)
      if (present.size === 0) setPrimary(mood)
      return
    }
    if (mood !== primary) {
      setPrimary(mood)
      return
    }
    if (present.size <= 1) return
    const next = new Set(present)
    next.delete(mood)
    setPresent(next)
    setPrimary([...next][0] ?? mood)
  }

  return (
    <div className="flex flex-col gap-4">
      <EmotionControls present={present} primary={primary} onCycle={cycleMood} />
      <BackgroundSwitcher
        emotions={emotions}
        activeKey={candidate.key}
        onSelect={setCandidateKey}
      />

      {/* Layered: emotion backdrop (z-0) · transparent 3D scene (z-10) · glass chrome (z-20). */}
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-black/50">
        <Backdrop emotions={emotions} reducedMotion={reducedMotion} className="z-0" />
        <div className="absolute inset-0 z-10">
          <EngramUniverseCanvas scene={scene} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="glass-subtle rounded-full px-3 py-1 text-xs font-medium text-text">{T.hud}</span>
            <span className="glass-subtle rounded-full px-3 py-1 text-xs text-text-muted">{candidate.label}</span>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-3">
            <div className="glass max-w-xs rounded-2xl p-4 text-text">
              <div className="mb-1 text-sm font-semibold">{T.overlayCardTitle}</div>
              <p className="mb-3 text-xs text-text-muted">{T.overlayCardBody}</p>
              <div className="flex gap-2">
                <Button size="sm">{T.recall}</Button>
                <Button size="sm" variant="secondary">
                  {T.history}
                </Button>
              </div>
            </div>
            <Button leadingIcon={<StarIcon />}>{T.write}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// The primary-emotion + present-emotions control: 13 mood chips, each tapped to cycle through the
// universe. Filled = present, ringed = primary, faded outline = absent. This is the "change the
// dominant emotion colour" surface — the backdrop repaints live as it changes.
function EmotionControls({
  present,
  primary,
  onCycle,
}: {
  present: ReadonlySet<Mood>
  primary: Mood
  onCycle: (mood: Mood) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
          {T.emotionsTitle} · {present.size}
        </h3>
        <span className="text-xs text-text-subtle">{T.emotionsHint}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((mood) => {
          const isPresent = present.has(mood)
          const isPrimary = mood === primary
          const color = moodColor(mood)
          return (
            <button
              key={mood}
              type="button"
              onClick={() => onCycle(mood)}
              aria-pressed={isPresent}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isPresent ? 'border-transparent text-text' : 'border-border text-text-subtle opacity-60 hover:opacity-100',
              )}
              style={{
                backgroundColor: isPresent ? rgba(color, isPrimary ? 0.42 : 0.2) : 'transparent',
                boxShadow: isPrimary ? `0 0 0 2px ${rgba(color, 0.95)}` : undefined,
              }}
            >
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
              {MOOD_LABEL[mood]}
              {isPrimary ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{T.primaryTag}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// The background-candidate switcher: a live thumbnail per candidate (rendered static to stay cheap
// — reducedMotion is forced on the previews) plus the selected one's blurb. Selecting swaps the
// live universe backdrop above.
function BackgroundSwitcher({
  emotions,
  activeKey,
  onSelect,
}: {
  emotions: readonly EmotionSlice[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  const active = BACKGROUND_CANDIDATES.find((entry) => entry.key === activeKey)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{T.backgroundTitle}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {BACKGROUND_CANDIDATES.map((entry) => {
          const Preview = entry.Component
          const selected = entry.key === activeKey
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => onSelect(entry.key)}
              aria-pressed={selected}
              title={entry.blurb}
              className={cx(
                'group flex flex-col overflow-hidden rounded-xl border text-left transition-colors',
                selected ? 'border-primary' : 'border-border hover:border-text-subtle',
              )}
            >
              <span className="relative block h-16 w-full overflow-hidden bg-black/60">
                <Preview emotions={emotions} reducedMotion />
              </span>
              <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-xs font-medium text-text">{entry.label}</span>
                {selected ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {active ? <p className="text-xs text-text-subtle">{active.blurb}</p> : null}
    </section>
  )
}

// A self-contained slice of the product universe for design work: it loads a fixed set of engram
// cells (8 episodic memories anchored to a handful of neurons) into the shared read-model stores
// and renders the real render layers over a static coordinate buffer — no force-sim, no backend.
// So the memory stars, cell-star neurons, synapse filaments, and emotion nebula all draw from
// genuine domain facts. The scene draws NO background node: the canvas clears transparent so the
// emotion-driven DOM backdrop behind it shows through. The skin still tunes camera + bloom.
function EngramUniverseCanvas({ scene }: { scene: EngramDemoScene }) {
  const { skin } = useSkin()
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
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov} transparent>
      <StarField />
      <NebulaField positions={positions} firstNodeIndex={scene.firstMemoryIndex} />
      <CellStarLayer positions={positions} />
      <StarLayer positions={positions} firstNodeIndex={scene.firstMemoryIndex} universeTime={scene.universeTime} />
      <FilamentLayer positions={positions} neuronIndexById={scene.neuronIndexById} universeTime={scene.universeTime} />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
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
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="ghost" label={T.back} icon={<Chevron />} />
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
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <MoodTag mood={memory.emotion.mood} />
            <Badge variant="neutral">{formatUniverseDay(memory.createdUniverseTime)}</Badge>
          </div>
          <h4 className="truncate text-base font-semibold text-text">{memory.name}</h4>
        </div>
        <IconButton size="sm" variant="ghost" label={T.more} icon={<EllipsisIcon />} />
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
      <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: moodColor(mood) }} />
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

      <Section title={T.buttonsMatrix}>
        <div className="grid gap-4">
          {CONTROL_SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <span className="w-8 text-xs uppercase tracking-wide text-text-subtle">{size}</span>
              {BUTTON_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title={T.buttonsStates}>
        <div className="flex flex-wrap items-center gap-3">
          <Button leadingIcon={<StarIcon />}>{T.leadingIcon}</Button>
          <Button trailingIcon={<StarIcon />} variant="secondary">
            {T.trailingIcon}
          </Button>
          <Button loading>{T.loadingButton}</Button>
          <Button disabled>{T.disabledButton}</Button>
          <Button variant="danger" disabled>
            {T.dangerDisabled}
          </Button>
        </div>
      </Section>

      <Section title={T.iconButtons}>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <IconButton key={variant} variant={variant} label={`${variant} icon action`} icon={<StarIcon />} />
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
          <TextField label={T.fieldWithDescription} description={T.fieldDescription} placeholder={T.placeholder} />
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
            <Button variant="secondary">{T.tooltipTrigger}</Button>
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
      <div className="rounded-md border border-border bg-surface p-4">{children}</div>
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
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
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

import { moodColor, type Mood } from '@cosimosi/emotion'
import { Badge, Button, Card, IconButton, Skeleton, TextArea, TextField } from '@cosimosi/ui'

import { ChevronIcon, EllipsisIcon, StarIcon } from './showcase-icons.tsx'
import { T } from './showcase-copy.ts'
import { LitBackdrop, Section, Specimen, Stage } from './showcase-shell.tsx'

/**
 * Patterns — the chrome the primitives compose into.
 *
 * A catalogue proves each control is consistent with itself; only a composed screen shows whether
 * the language holds at page altitude — whether hierarchy survives, whether density is right, and
 * whether glass still reads once real content sits on it. These are static mocks built from the
 * same primitives as the product, deliberately not wired to the domain: this page is about how the
 * chrome looks, and a live read would only make it slower to open and harder to reproduce.
 *
 * The 3D universe is NOT reproduced here — the rendered bodies and the sky belong to the renderer
 * and are reviewed on their own surface. Where a pattern needs a lit ground to be judged, it gets
 * the review backdrop instead.
 */

// Demo memories, presentation-only: enough of a shape to fill a list and a detail panel. Not the
// domain read model — the /test surface owns the one that loads real stores.
const DEMO_MEMORIES: readonly {
  id: string
  name: string
  mood: Mood
  day: string
  strength: number
  excerpt: string
  recalled: string | null
}[] = [
  {
    id: 'm-winter-sea',
    name: 'Winter sea',
    mood: 'CALM',
    day: 'Y1 · D18',
    strength: 0.82,
    excerpt: 'The water was the colour of old coins. We did not say much on the way back.',
    recalled: 'Recalled 3× · last Y1 · D24',
  },
  {
    id: 'm-laughing-rain',
    name: 'Laughing in the rain',
    mood: 'JOY',
    day: 'Y1 · D21',
    strength: 0.64,
    excerpt: 'We ran for the awning and missed it entirely — soaked, laughing at nothing.',
    recalled: 'Recalled 1× · last Y1 · D22',
  },
  {
    id: 'm-unsent-letter',
    name: 'The unsent letter',
    mood: 'SAD',
    day: 'Y1 · D23',
    strength: 0.41,
    excerpt: 'Wrote it twice, folded it once, left it in the drawer with the others.',
    recalled: null,
  },
  {
    id: 'm-morning-light',
    name: 'First light',
    mood: 'GRATITUDE',
    day: 'Y1 · D27',
    strength: 0.93,
    excerpt: 'The whole day still unspent. Just the cup, warm in both hands.',
    recalled: null,
  },
]

const PROPOSED: readonly { name: string; mood: Mood }[] = [
  { name: 'The rain stopping', mood: 'CALM' },
  { name: 'The same page, four times', mood: 'TIRED' },
]

export function PatternsPanel() {
  return (
    <>
      <WritingSection />
      <DetailSection />
      <HudSection />
      <ListSection />
      <StatesSection />
    </>
  )
}

// ── Writing flow ──────────────────────────────────────────────────────────────
function WritingSection() {
  return (
    <Section id="writing" title={T.writingTitle} blurb={T.writingBlurb}>
      <Stage className="flex-col">
        <div className="mx-auto flex w-full max-w-measure flex-col gap-5">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-2xl font-semibold tracking-tight">{T.writingHeading}</h4>
            <Badge variant="neutral">{T.writingDate}</Badge>
          </div>
          <TextArea
            aria-label={T.writingHeading}
            placeholder={T.writingPlaceholder}
            rows={5}
            defaultValue={T.writingBody}
          />
          <div className="flex justify-end">
            <Button leadingIcon={<StarIcon />}>{T.writingSplit}</Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
              {T.writingProposed}
            </span>
            {PROPOSED.map((proposed) => (
              <div
                key={proposed.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <MoodDot mood={proposed.mood} />
                  <span className="truncate text-sm text-text">{proposed.name}</span>
                </span>
                <Badge variant="neutral">{T.moodLabels[proposed.mood]}</Badge>
              </div>
            ))}
            <div className="flex justify-end">
              <Button color="secondary">{T.writingLaunch}</Button>
            </div>
          </div>
        </div>
      </Stage>
    </Section>
  )
}

// ── Star detail ───────────────────────────────────────────────────────────────
function DetailSection() {
  const memory = DEMO_MEMORIES[0]
  return (
    <Section id="detail" title={T.detailTitle} blurb={T.detailBlurb}>
      <LitBackdrop>
        <Card variant="glass" className="mx-auto flex w-full max-w-md flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <MoodBadge mood={memory.mood} />
                <Badge variant="neutral">{memory.day}</Badge>
              </div>
              <h4 className="truncate text-lg font-semibold">{memory.name}</h4>
            </div>
            <span
              aria-hidden
              className="bloom-soft size-12 shrink-0 rounded-2xl"
              style={{ backgroundColor: moodColor(memory.mood) }}
            />
          </div>

          <p className="text-sm leading-6 text-text-muted">{T.detailBody}</p>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <StrengthMeter value={memory.strength} />
            <span className="text-xs text-text-subtle">{T.detailRecalled}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm">{T.detailRecall}</Button>
            <Button size="sm" variant="outlined" color="neutral">
              {T.detailHistory}
            </Button>
            <Button size="sm" variant="text" color="neutral">
              {T.detailSource}
            </Button>
          </div>
        </Card>
      </LitBackdrop>
    </Section>
  )
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function HudSection() {
  return (
    <Section id="hud" title={T.hudTitle} blurb={T.hudBlurb}>
      <LitBackdrop>
        <div className="flex min-h-64 flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <span className="glass-subtle rounded-full px-3 py-1 text-xs text-text-muted">
              {T.hudTime}
            </span>
            <span className="glass-subtle rounded-full px-3 py-1 text-xs text-text-muted">
              {T.hudBalance}
            </span>
          </div>
          <div className="flex justify-end">
            <Button leadingIcon={<StarIcon />}>{T.hudWrite}</Button>
          </div>
        </div>
      </LitBackdrop>
    </Section>
  )
}

// ── List page ─────────────────────────────────────────────────────────────────
function ListSection() {
  return (
    <Section id="list" title={T.listTitle} blurb={T.listBlurb}>
      <div className="card-surface overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <IconButton
              size="sm"
              variant="text"
              color="neutral"
              label={T.listBack}
              icon={<ChevronIcon />}
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text">{T.listHeading}</span>
              <span className="text-xs text-text-subtle">
                {DEMO_MEMORIES.length} {T.listMemories}
              </span>
            </div>
          </div>
          <Button size="sm" leadingIcon={<StarIcon />}>
            {T.hudWrite}
          </Button>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-56 flex-1">
              <TextField aria-label={T.listSearch} placeholder={T.listSearch} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">{T.listSortRecent}</Badge>
              <Badge variant="neutral">{T.listSortStrongest}</Badge>
            </div>
          </div>

          <div className="grid gap-3">
            {DEMO_MEMORIES.map((memory) => (
              <article
                key={memory.id}
                className="flex flex-col gap-3 rounded-2xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <MoodBadge mood={memory.mood} />
                      <Badge variant="neutral">{memory.day}</Badge>
                    </div>
                    <h4 className="truncate text-base font-semibold text-text">{memory.name}</h4>
                  </div>
                  <IconButton
                    size="sm"
                    variant="text"
                    color="neutral"
                    label={T.listMore}
                    icon={<EllipsisIcon />}
                  />
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-text-muted">{memory.excerpt}</p>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-xs text-text-subtle">
                    {memory.recalled ?? T.detailRecalled}
                  </span>
                  <StrengthMeter value={memory.strength} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── Empty / loading / error ───────────────────────────────────────────────────
function StatesSection() {
  return (
    <Section id="states" title={T.statesTitle} blurb={T.statesBlurb}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Specimen label={T.stateEmpty}>
          <Card className="flex h-full flex-col items-start gap-3">
            <span aria-hidden className="bloom-soft size-10 rounded-full bg-surface-raised" />
            <span className="text-base font-semibold">{T.emptyHeading}</span>
            <p className="text-sm leading-6 text-text-muted">{T.emptyBody}</p>
            <Button size="sm">{T.emptyAction}</Button>
          </Card>
        </Specimen>

        <Specimen label={T.stateLoading}>
          <Card className="flex h-full flex-col gap-3" aria-busy>
            <span className="text-base font-semibold">{T.loadingHeading}</span>
            <Skeleton width="100%" height={14} />
            <Skeleton width="80%" height={14} />
            <Skeleton width="60%" height={14} />
          </Card>
        </Specimen>

        <Specimen label={T.stateError}>
          <Card className="flex h-full flex-col items-start gap-3" role="alert">
            <Badge variant="danger">{T.stateError}</Badge>
            <span className="text-base font-semibold">{T.errorHeading}</span>
            <p className="text-sm leading-6 text-text-muted">{T.errorBody}</p>
            <Button size="sm" variant="outlined" color="neutral">
              {T.errorAction}
            </Button>
          </Card>
        </Specimen>
      </div>
    </Section>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────
// The emotion colour comes from the emotion package, not from this page: mood → colour is a domain
// projection, and a review surface that invented its own would be reviewing the wrong palette.
function MoodDot({ mood }: { mood: Mood }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: moodColor(mood) }}
    />
  )
}

function MoodBadge({ mood }: { mood: Mood }) {
  return (
    <Badge variant="neutral">
      <span aria-hidden className="badge-dot" style={{ backgroundColor: moodColor(mood) }} />
      {T.moodLabels[mood]}
    </Badge>
  )
}

function StrengthMeter({ value }: { value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-subtle">{T.detailStrength}</span>
      <div
        role="progressbar"
        aria-label={T.detailStrength}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

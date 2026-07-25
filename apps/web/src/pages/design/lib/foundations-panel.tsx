import { useState } from 'react'

import {
  Badge,
  Button,
  Card,
  Checkbox,
  IconButton,
  Switch,
  TextField,
  contrastRatio,
  cx,
  defaultThemeKey,
  palette,
  themes,
  tokens,
  useReducedMotion,
  WCAG_AA_TEXT,
  type ThemePalette,
} from '@cosimosi/ui'

import { PlayIcon, StarIcon } from './showcase-icons.tsx'
import { T } from './showcase-copy.ts'
import { LabeledRow, LitBackdrop, Section, Specimen, Stage } from './showcase-shell.tsx'

/**
 * Foundations — the material the language is made of.
 *
 * Everything here is READ from the token source rather than restated: the swatch grid iterates the
 * active theme's role map, the contrast table measures the authored OKLCH values, and each specimen
 * renders through the same CSS variable a product surface would use. A token that drifts out of the
 * system therefore shows up on this page as a wrong swatch, not as a silently stale doc.
 */

const activeTheme = themes[defaultThemeKey]

// The pairs a reader's eye actually lands on. Mirrors the gate in packages/ui/src/tokens.test.ts —
// this page shows what that test asserts, so a designer sees the same list the build enforces.
const CONTRAST_PAIRS: ReadonlyArray<[fg: keyof ThemePalette, bg: keyof ThemePalette]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-raised'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-raised'],
  ['text-subtle', 'surface'],
  ['text-subtle', 'surface-raised'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['tertiary-foreground', 'tertiary'],
  ['danger-foreground', 'danger'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
]

const TYPE_ROLES: readonly { label: string; className: string }[] = [
  { label: 'display', className: 'text-4xl font-semibold tracking-tight' },
  { label: 'title', className: 'text-2xl font-semibold tracking-tight' },
  { label: 'section', className: 'text-lg font-semibold' },
  { label: 'body', className: 'text-base leading-7' },
  { label: 'small', className: 'text-sm leading-6 text-text-muted' },
  { label: 'eyebrow', className: 'text-xs font-semibold uppercase tracking-wide text-text-subtle' },
]

// `Object.keys` widens numeric keys to string; the scales are read back through them, so each list
// is re-narrowed to its own key union rather than restated as a literal array that could fall behind.
const SPACING_STEPS = Object.keys(tokens.spacing) as unknown as (keyof typeof tokens.spacing)[]
const RADIUS_STEPS = Object.keys(tokens.radius) as (keyof typeof tokens.radius)[]
const SHADOW_STEPS = Object.keys(tokens.shadow) as (keyof typeof tokens.shadow)[]
const DURATIONS = Object.keys(tokens.duration) as (keyof typeof tokens.duration)[]

export function FoundationsPanel() {
  return (
    <>
      <ThemeSection />
      <ContrastSection />
      <TypeSection />
      <SpacingSection />
      <ElevationSection />
      <MotionSection />
      <FocusSection />
    </>
  )
}

// ── Theme ─────────────────────────────────────────────────────────────────────
// The registry, rendered. Each swatch paints itself with `var(--color-<role>)` — the variable the
// generator wrote — while the caption prints the value the palette authored. If the two ever
// disagreed, the swatch and its label would visibly disagree here.
function ThemeSection() {
  const roles = Object.keys(palette) as (keyof ThemePalette)[]
  return (
    <Section id="theme" title={T.themeTitle} blurb={T.themeBlurb}>
      <Specimen label={T.activeTheme} note={activeTheme.blurb}>
        <Stage>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="primary">{activeTheme.label}</Badge>
            <code className="text-xs text-text-muted">{`${T.themeAttribute}="${defaultThemeKey}"`}</code>
            <span className="text-xs text-text-subtle">
              {T.registeredThemes} · {Object.keys(themes).length}
            </span>
          </div>
        </Stage>
      </Specimen>

      <Specimen label={T.roleName} note={T.roleValue}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role} className="flex items-center gap-3 rounded-xl border border-border p-2">
              <span
                aria-hidden
                className="size-10 shrink-0 rounded-lg border border-border"
                style={{ backgroundColor: `var(--color-${role})` }}
              />
              <span className="flex min-w-0 flex-col">
                <code className="truncate text-xs font-medium text-text">{role}</code>
                <code className="truncate text-xs text-text-subtle">{palette[role]}</code>
              </span>
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  )
}

// ── Contrast ──────────────────────────────────────────────────────────────────
function ContrastSection() {
  return (
    <Section id="contrast" title={T.contrastTitle} blurb={T.contrastBlurb}>
      <div className="grid gap-3 sm:grid-cols-2">
        {CONTRAST_PAIRS.map(([fg, bg]) => {
          const ratio = contrastRatio(palette[fg], palette[bg])
          const passes = ratio >= WCAG_AA_TEXT
          return (
            <div
              key={`${fg}-${bg}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              style={{ backgroundColor: `var(--color-${bg})` }}
            >
              <span className="min-w-0 truncate text-sm" style={{ color: `var(--color-${fg})` }}>
                {fg} {T.contrastAgainst} {bg}
              </span>
              <Badge variant={passes ? 'success' : 'danger'}>
                {ratio.toFixed(2)} · {passes ? T.contrastPass : T.contrastFail}
              </Badge>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── Typography ────────────────────────────────────────────────────────────────
function TypeSection() {
  return (
    <Section id="type" title={T.typeTitle} blurb={T.typeBlurb}>
      <Stage className="flex-col">
        <div className="flex w-full flex-col gap-5">
          {TYPE_ROLES.map((role) => (
            <div key={role.label} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <code className="w-20 shrink-0 text-xs text-text-subtle">{role.label}</code>
              <span className={role.className}>{T.typeSpecimen}</span>
            </div>
          ))}
        </div>
      </Stage>

      <Specimen label={T.measureTitle}>
        <Stage className="flex-col">
          <p className="max-w-measure text-base leading-7 text-text-muted">{T.measureBody}</p>
        </Stage>
      </Specimen>
    </Section>
  )
}

// ── Spacing + radius ──────────────────────────────────────────────────────────
function SpacingSection() {
  return (
    <Section id="spacing" title={T.spacingTitle} blurb={T.spacingBlurb}>
      <Stage className="flex-col">
        <div className="flex w-full flex-col gap-2">
          {SPACING_STEPS.map((step) => (
            <div key={step} className="flex items-center gap-3">
              <code className="w-8 shrink-0 text-xs text-text-subtle">{step}</code>
              <span
                aria-hidden
                className="h-3 min-w-px rounded-sm bg-primary"
                style={{ width: `${tokens.spacing[step]}px` }}
              />
              <code className="text-xs text-text-subtle">{tokens.spacing[step]}</code>
            </div>
          ))}
        </div>
      </Stage>

      <Specimen label={T.radiusTitle} note={T.radiusBlurb}>
        <Stage>
          {RADIUS_STEPS.map((step) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className="size-16 border border-border bg-surface-raised"
                style={{ borderRadius: tokens.radius[step] }}
              />
              <code className="text-xs text-text-subtle">{step}</code>
            </div>
          ))}
        </Stage>
      </Specimen>
    </Section>
  )
}

// ── Elevation ─────────────────────────────────────────────────────────────────
function ElevationSection() {
  return (
    <Section id="elevation" title={T.elevationTitle} blurb={T.elevationBlurb}>
      <Specimen label={T.elevationShadows}>
        <Stage>
          {SHADOW_STEPS.map((step) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className="size-20 rounded-xl bg-surface-raised"
                style={{ boxShadow: tokens.shadow[step] }}
              />
              <code className="text-xs text-text-subtle">{step}</code>
            </div>
          ))}
        </Stage>
      </Specimen>

      <Specimen label={T.elevationSurfaces}>
        <LitBackdrop>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card variant="solid" className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{T.cardSolidTitle}</span>
              <span className="text-sm text-text-muted">{T.cardSolidBody}</span>
            </Card>
            <Card variant="glass" className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{T.cardGlassTitle}</span>
              <span className="text-sm text-text-muted">{T.cardGlassBody}</span>
            </Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass-subtle rounded-xl p-3 text-xs text-text-muted">
              {T.glassSubtle}
            </div>
            <div className="glass rounded-xl p-3 text-xs text-text-muted">{T.glassDefault}</div>
            <div className="glass-strong rounded-xl p-3 text-xs text-text-muted">
              {T.glassStrong}
            </div>
          </div>
        </LitBackdrop>
      </Specimen>
    </Section>
  )
}

// ── Motion ────────────────────────────────────────────────────────────────────
function MotionSection() {
  const reduced = useReducedMotion()
  const [shifted, setShifted] = useState(false)
  return (
    <Section id="motion" title={T.motionTitle} blurb={T.motionBlurb}>
      <Stage className="flex-col">
        <div className="flex w-full flex-col gap-4">
          {DURATIONS.map((step) => (
            <LabeledRow key={step} label={step}>
              <code className="text-xs text-text-subtle">{tokens.duration[step]}</code>
              <span
                aria-hidden
                className={cx('size-6 rounded-md bg-primary', shifted && 'translate-x-40')}
                style={{
                  transitionProperty: 'transform',
                  transitionDuration: tokens.duration[step],
                  transitionTimingFunction: tokens.ease.standard,
                }}
              />
            </LabeledRow>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              size="sm"
              leadingIcon={<PlayIcon />}
              onClick={() => setShifted((current) => !current)}
            >
              {T.motionPlay}
            </Button>
            <span className="text-xs text-text-subtle">
              {reduced ? T.motionReducedOn : T.motionReducedOff}
            </span>
          </div>
        </div>
      </Stage>
    </Section>
  )
}

// ── Focus ─────────────────────────────────────────────────────────────────────
function FocusSection() {
  return (
    <Section id="focus" title={T.focusTitle} blurb={T.focusBlurb}>
      <Stage>
        <Button>{T.stateFocus}</Button>
        <Button variant="outlined" color="neutral">
          {T.stateFocus}
        </Button>
        <IconButton variant="contained" label={T.focusTitle} icon={<StarIcon />} />
        <div className="w-48">
          <TextField aria-label={T.fieldLabel} placeholder={T.fieldPlaceholder} />
        </div>
        <Switch ariaLabel={T.switchLabel} />
        <Checkbox ariaLabel={T.checkboxLabel} />
      </Stage>
    </Section>
  )
}

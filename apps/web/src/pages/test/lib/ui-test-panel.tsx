import { useEffect, useState, type ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import { SkinProvider, UniverseCanvas, UniverseScene, useSkin, type SkinKey } from '@cosimosi/3d-renderer'
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
  type BadgeVariant,
  type ButtonVariant,
  type ControlSize,
} from '@cosimosi/ui'

// The single UI test surface. A preset is a *universe*: one switch drives the 3D skin and
// the 2D theme together (data-theme on the document root re-skins portals too), so the whole
// component catalog + universe view re-skin at once. Captions are demo data, intentionally
// outside the product i18n catalog (a dev-only /test surface).
const PRESETS: readonly { key: SkinKey; label: string; blurb: string }[] = [
  { key: 'aurora', label: 'Aurora', blurb: 'Cool borealis — lavender · chartreuse · mint.' },
  { key: 'ember', label: 'Ember', blurb: 'Warm cosmic — ember-coral · rose · gold.' },
]

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const CONTROL_SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
const BADGE_VARIANTS: readonly BadgeVariant[] = ['neutral', 'primary', 'success', 'warning', 'danger']

const ACCENTS: readonly { name: string; bg: string; fg: string }[] = [
  { name: 'Primary', bg: 'bg-primary', fg: 'text-primary-foreground' },
  { name: 'Secondary', bg: 'bg-secondary', fg: 'text-secondary-foreground' },
  { name: 'Tertiary', bg: 'bg-tertiary', fg: 'text-tertiary-foreground' },
]

const STATS: readonly { label: string; value: string }[] = [
  { label: 'Strength', value: '0.62' },
  { label: 'Brightness', value: '0.90' },
  { label: 'Recall count', value: '3' },
  { label: 'Neurons', value: '7' },
]

const T = {
  universeAndUi: 'Universe + UI',
  components: 'Components',
  composed: 'Composed screen',
  hud: '우주의 시간 · Y1 · D28',
  overlayCardTitle: 'A quiet afternoon',
  overlayCardBody: 'A surface floating over the live universe.',
  write: 'Write a diary',
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
  back: 'Back',
  share: 'Share',
  more: 'More',
  universeCrumb: 'Universe',
  moodBadge: '기쁨',
  dateBadge: 'Year 1 · Day 12',
  detailTitle: 'A quiet afternoon by the window',
  detailMeta: 'Recalled 3 times · last seen 4 days ago',
  detailBody:
    'The light came in ▓▓▓ warm across the desk, and for a moment ▓▓▓▓ nothing needed to be done. A cup of tea went cold while ▓▓▓▓▓ the page stayed open to the same line.',
  recall: '회고하기',
  history: '변천사',
  original: '원본 일기 보기',
  pin: 'Pin to constellation',
}

function UiTestInner() {
  const { skin, skinKey, setSkinKey } = useSkin()
  const [toastOpen, setToastOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(false)
  const [checked, setChecked] = useState(true)
  const [starred, setStarred] = useState(true)

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

      {/* ── Universe + UI ─────────────────────────────────────── */}
      <Section title={T.universeAndUi}>
        <div className="relative h-[52vh] min-h-96 overflow-hidden rounded-lg border border-border bg-bg">
          <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
            <UniverseScene skin={skin} />
          </UniverseCanvas>
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex items-start justify-between">
              <Badge variant="primary">{T.hud}</Badge>
            </div>
            <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-xs rounded-lg border border-border bg-surface p-4 shadow-card">
                <div className="mb-1 text-sm font-semibold text-text">{T.overlayCardTitle}</div>
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
      </Section>

      {/* ── Components ────────────────────────────────────────── */}
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

      {/* ── Composed screen (2D only) ─────────────────────────── */}
      <Section title={T.composed}>
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <IconButton size="sm" variant="ghost" label={T.back} icon={<Chevron />} />
              <span className="text-sm font-medium text-text-muted">{T.universeCrumb}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconButton size="sm" variant="ghost" label={T.share} icon={<StarIcon />} />
              <IconButton size="sm" variant="ghost" label={T.more} icon={<StarIcon />} />
            </div>
          </header>
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_15rem]">
            <article className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">{T.moodBadge}</Badge>
                  <Badge variant="neutral">{T.dateBadge}</Badge>
                </div>
                <h4 className="text-2xl font-semibold text-text">{T.detailTitle}</h4>
                <p className="text-sm text-text-subtle">{T.detailMeta}</p>
              </div>
              <p className="leading-7 text-text">{T.detailBody}</p>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button>{T.recall}</Button>
                <Button variant="secondary">{T.history}</Button>
                <Button variant="ghost">{T.original}</Button>
              </div>
            </article>
            <aside className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">{stat.label}</span>
                    <span className="text-sm font-semibold text-text">{stat.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <span className="text-sm text-text">{T.pin}</span>
                <Switch ariaLabel={T.pin} checked={starred} onCheckedChange={setStarred} />
              </div>
            </aside>
          </div>
        </div>
      </Section>
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

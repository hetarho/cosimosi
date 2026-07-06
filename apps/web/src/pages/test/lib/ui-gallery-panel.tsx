import { useState, type ReactNode } from 'react'

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

/*
 * Design showcase — a dev-only /test surface for tuning the 2D design language.
 * Its captions are technical identifiers / demo labels, driven from the `T` data block
 * below like the sibling demo panels (render-demo-panel drives its labels from
 * UNIVERSE_SKINS). They intentionally stay out of the product i18n catalog: real product
 * screens localize copy through `m.*`; this scratchpad's scaffolding does not.
 */

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const CONTROL_SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
const BADGE_VARIANTS: readonly BadgeVariant[] = ['neutral', 'primary', 'success', 'warning', 'danger']

const T = {
  intro:
    'The current 2D primitive catalog, rendered in every variant / size / state. This is the surface we tune the design language on — as the target look is decided, its variants land here beside the current ones.',
  buttonsMatrix: 'Buttons · variants × sizes',
  buttonsStates: 'Buttons · states',
  iconButtons: 'Icon buttons',
  badges: 'Badges',
  fields: 'Fields',
  toggles: 'Toggles',
  overlays: 'Overlays',
  loadingSection: 'Loading — skeleton',
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
} as const

export function UiGalleryPanel() {
  const [toastOpen, setToastOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(false)
  const [checked, setChecked] = useState(true)

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm leading-6 text-text-muted">{T.intro}</p>

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

      <Section title={T.loadingSection}>
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
      <div className="rounded-md border border-border bg-surface-subtle p-4">{children}</div>
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

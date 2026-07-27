import { useState } from 'react'

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  IconButton,
  Select,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  type BadgeVariant,
  type ButtonColor,
  type ButtonVariant,
  type ControlSize,
} from '@cosimosi/ui'

import { EllipsisIcon, StarIcon } from './showcase-icons.tsx'
import { T } from './showcase-copy.ts'
import {
  LabeledRow,
  LitBackdrop,
  Section,
  Specimen,
  Stage,
  StateMatrix,
  type PreviewState,
} from './showcase-shell.tsx'

/**
 * Primitives — every control the product is allowed to use, in every state it can be in.
 *
 * The point of the state matrices is that hover, focus and pressed are *design decisions* the same
 * as the resting state, and they are the ones that go unreviewed because a static mock cannot hold
 * them. Here they are held by the design system's own rules (the `.state-*` preview hooks), so what
 * is on screen is what a pointer would produce, not a hand-drawn approximation of it.
 */

const APPEARANCES: readonly { variant: ButtonVariant; label: string }[] = [
  { variant: 'contained', label: 'contained' },
  { variant: 'outlined', label: 'outlined' },
  { variant: 'text', label: 'text' },
]
const COLORS: readonly ButtonColor[] = ['primary', 'secondary', 'tertiary', 'neutral', 'danger']
const SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
const BADGES: readonly BadgeVariant[] = ['neutral', 'primary', 'success', 'warning', 'danger']

const INTERACTIVE_STATES: readonly PreviewState[] = [
  'default',
  'hover',
  'focus',
  'pressed',
  'disabled',
  'loading',
]
const SURFACE_STATES: readonly PreviewState[] = ['default', 'hover', 'focus', 'disabled']

// A bounded set, shown as one: the specimen exists so a reviewer can see the well, the sizes and the
// invalid rim on a picker, not to demonstrate a domain vocabulary.
const SELECT_ITEMS = [
  { value: 'first', label: 'First option' },
  { value: 'second', label: 'Second option' },
  { value: 'third', label: 'Third option' },
] as const

export function PrimitivesPanel() {
  return (
    <>
      <ButtonSection />
      <IconButtonSection />
      <BadgeSection />
      <FieldSection />
      <ToggleSection />
      <OverlaySection />
      <FeedbackSection />
    </>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
function ButtonSection() {
  return (
    <Section id="button" title={T.buttonTitle} blurb={T.buttonBlurb}>
      <Specimen label={T.buttonMatrix}>
        <Stage className="flex-col">
          <div className="flex w-full flex-col gap-4">
            {APPEARANCES.map((appearance) => (
              <LabeledRow key={appearance.variant} label={appearance.label}>
                {COLORS.map((color) => (
                  <Button key={color} variant={appearance.variant} color={color}>
                    {color}
                  </Button>
                ))}
              </LabeledRow>
            ))}
          </div>
        </Stage>
      </Specimen>

      <Specimen label={T.buttonSizes}>
        <Stage>
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </Stage>
      </Specimen>

      <Specimen label={T.buttonStates} note={T.primitiveStates}>
        <Stage className="flex-col">
          <div className="flex w-full flex-col gap-6">
            {APPEARANCES.map((appearance) => (
              <div key={appearance.variant} className="flex flex-col gap-3">
                <code className="text-xs text-text-subtle">{appearance.label}</code>
                <StateMatrix
                  states={INTERACTIVE_STATES}
                  render={(state) => (
                    <Button
                      variant={appearance.variant}
                      disabled={state === 'disabled'}
                      loading={state === 'loading'}
                    >
                      {appearance.label}
                    </Button>
                  )}
                />
              </div>
            ))}
          </div>
        </Stage>
      </Specimen>

      <Specimen label={T.buttonIcons}>
        <Stage>
          <Button leadingIcon={<StarIcon />}>{T.writingLaunch}</Button>
          <Button color="neutral" trailingIcon={<StarIcon />}>
            {T.detailHistory}
          </Button>
          <Button variant="outlined" color="danger" leadingIcon={<StarIcon />}>
            {T.dialogConfirm}
          </Button>
        </Stage>
      </Specimen>
    </Section>
  )
}

// ── Icon button ───────────────────────────────────────────────────────────────
function IconButtonSection() {
  return (
    <Section id="icon-button" title={T.iconButtonTitle} blurb={T.iconButtonBlurb}>
      <Specimen label={T.buttonMatrix}>
        <Stage className="flex-col">
          <div className="flex w-full flex-col gap-4">
            {APPEARANCES.map((appearance) => (
              <LabeledRow key={appearance.variant} label={appearance.label}>
                {COLORS.map((color) => (
                  <IconButton
                    key={color}
                    variant={appearance.variant}
                    color={color}
                    label={`${appearance.label} ${color}`}
                    icon={<StarIcon />}
                  />
                ))}
              </LabeledRow>
            ))}
          </div>
        </Stage>
      </Specimen>

      <Specimen label={T.buttonStates}>
        <Stage>
          <StateMatrix
            states={INTERACTIVE_STATES}
            render={(state) => (
              <IconButton
                variant="contained"
                label={state}
                icon={<StarIcon />}
                disabled={state === 'disabled'}
                loading={state === 'loading'}
              />
            )}
          />
        </Stage>
      </Specimen>

      <Specimen label={T.buttonSizes}>
        <Stage>
          {SIZES.map((size) => (
            <IconButton
              key={size}
              variant="contained"
              size={size}
              label={size}
              icon={<EllipsisIcon />}
            />
          ))}
        </Stage>
      </Specimen>
    </Section>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function BadgeSection() {
  return (
    <Section id="badge" title={T.badgeTitle} blurb={T.badgeBlurb}>
      <Stage>
        {BADGES.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Stage>

      <Specimen label={T.badgeOnScene}>
        <LitBackdrop>
          <div className="flex flex-wrap items-center gap-3">
            {BADGES.map((variant) => (
              <Badge key={variant} variant={variant} data-on-scene>
                {variant}
              </Badge>
            ))}
          </div>
        </LitBackdrop>
      </Specimen>
    </Section>
  )
}

// ── Fields ────────────────────────────────────────────────────────────────────
function FieldSection() {
  return (
    <Section id="field" title={T.fieldTitle} blurb={T.fieldBlurb}>
      <Specimen label={T.buttonStates} note={T.primitiveStates}>
        <Stage className="flex-col">
          <StateMatrix
            states={SURFACE_STATES}
            render={(state) => (
              <div className="w-52">
                <TextField
                  aria-label={T.fieldLabel}
                  placeholder={T.fieldPlaceholder}
                  disabled={state === 'disabled'}
                />
              </div>
            )}
          />
        </Stage>
      </Specimen>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={T.fieldLabel} placeholder={T.fieldPlaceholder} />
        <TextField
          label={T.fieldDescribed}
          description={T.fieldDescription}
          placeholder={T.fieldPlaceholder}
        />
        <TextField label={T.fieldInvalid} error={T.fieldError} placeholder={T.fieldPlaceholder} />
        <TextField label={T.fieldDisabled} placeholder={T.fieldPlaceholder} disabled />
        <Select
          label={T.selectLabel}
          items={SELECT_ITEMS}
          value={SELECT_ITEMS[0].value}
          onValueChange={() => {}}
        />
        <Select
          label={T.selectDescribed}
          description={T.fieldDescription}
          items={SELECT_ITEMS}
          value={SELECT_ITEMS[0].value}
          onValueChange={() => {}}
        />
        <Select
          label={T.selectInvalid}
          error={T.fieldError}
          items={SELECT_ITEMS}
          value={SELECT_ITEMS[0].value}
          onValueChange={() => {}}
        />
        <Select
          label={T.selectDisabled}
          items={SELECT_ITEMS}
          value={SELECT_ITEMS[0].value}
          onValueChange={() => {}}
          disabled
        />
        <div className="sm:col-span-2">
          <TextArea label={T.textAreaLabel} placeholder={T.textAreaPlaceholder} rows={3} />
        </div>
      </div>

      {/* Focus is the state a screenshot cannot catch, so the review surface stages it explicitly —
          the same StateMatrix the other fields use. */}
      <Specimen label={T.selectLabel} note={T.selectStates}>
        <Stage className="flex-col">
          <StateMatrix
            states={SURFACE_STATES}
            render={(state) => (
              <div className="w-52">
                <Select
                  ariaLabel={T.selectLabel}
                  items={SELECT_ITEMS}
                  value={SELECT_ITEMS[0].value}
                  onValueChange={() => {}}
                  disabled={state === 'disabled'}
                />
              </div>
            )}
          />
        </Stage>
      </Specimen>
    </Section>
  )
}

// ── Toggles ───────────────────────────────────────────────────────────────────
function ToggleSection() {
  const [notify, setNotify] = useState(true)
  const [remember, setRemember] = useState(true)
  return (
    <Section id="toggle" title={T.toggleTitle} blurb={T.toggleBlurb}>
      <Stage className="flex-col">
        <div className="flex w-full flex-col gap-5">
          <LabeledRow label={T.stateDefault}>
            <Switch label={T.switchLabel} checked={notify} onCheckedChange={setNotify} />
            <Checkbox label={T.checkboxLabel} checked={remember} onCheckedChange={setRemember} />
          </LabeledRow>
          <LabeledRow label={T.stateDisabled}>
            <Switch label={T.switchDisabledLabel} checked disabled />
            <Checkbox label={T.checkboxDisabledLabel} checked={false} disabled />
          </LabeledRow>
        </div>
      </Stage>
    </Section>
  )
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function OverlaySection() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  return (
    <Section id="overlay" title={T.overlayTitle} blurb={T.overlayBlurb}>
      <Stage>
        <Tooltip content={T.tooltipContent}>
          <Button color="neutral">{T.tooltipTrigger}</Button>
        </Tooltip>
        <Button color="neutral" onClick={() => setToastOpen(true)}>
          {T.toastTrigger}
        </Button>
        <Button onClick={() => setDialogOpen(true)}>{T.dialogTrigger}</Button>
      </Stage>

      <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" durationMs={2400}>
        {T.toastBody}
      </Toast>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={T.dialogTitle}
        description={T.dialogBody}
        closeLabel={T.dialogClose}
      >
        <div className="flex flex-col gap-5">
          <Checkbox label={T.dialogDontAsk} />
          <div className="flex justify-end gap-2">
            <Button variant="text" color="neutral" onClick={() => setDialogOpen(false)}>
              {T.dialogCancel}
            </Button>
            <Button color="danger" onClick={() => setDialogOpen(false)}>
              {T.dialogConfirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </Section>
  )
}

// ── Feedback ──────────────────────────────────────────────────────────────────
function FeedbackSection() {
  return (
    <Section id="feedback" title={T.feedbackTitle} blurb={T.feedbackBlurb}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {T.skeletonLabel}
          </span>
          <div className="flex items-center gap-3">
            <Skeleton width={40} height={40} rounded="full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton width="70%" height={14} />
              <Skeleton width="45%" height={12} />
            </div>
          </div>
          <Skeleton width="100%" height={12} />
          <Skeleton width="85%" height={12} />
        </Card>
        <Card className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {T.spinnerLabel}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>{T.stateLoading}</Button>
            <IconButton variant="contained" loading label={T.stateLoading} icon={<StarIcon />} />
          </div>
        </Card>
        {/* All four alert roles side by side: the rim is the only thing that changes, so a reviewer
            can see at once that no variant is louder than the copy it carries. */}
        <Card className="flex flex-col gap-3 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {T.alertLabel}
          </span>
          <Alert variant="danger">{T.alertDanger}</Alert>
          <Alert variant="warning" live="status">
            {T.alertWarning}
          </Alert>
          <Alert variant="info" live="status">
            {T.alertInfo}
          </Alert>
          <Alert variant="success" live="status">
            {T.alertSuccess}
          </Alert>
        </Card>
      </div>
    </Section>
  )
}

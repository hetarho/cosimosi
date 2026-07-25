import type { ReactNode } from 'react'

import { cx } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'

/**
 * The showcase's own layout vocabulary — a section, a labelled example, and the state matrix.
 *
 * These are review furniture, not product components: they exist so every specimen below is framed
 * the same way and a designer compares like with like instead of re-reading a new layout on each
 * scroll. They are built from the same tokens as everything else, so they can never quietly become
 * a second design language sitting around the first one.
 */

/** A top-level section, anchored so the sidebar can jump to it. */
export function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string
  title: string
  blurb?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-8">
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-tight text-text">
          {title}
        </h2>
        {blurb ? <p className="max-w-measure text-sm leading-6 text-text-muted">{blurb}</p> : null}
      </div>
      <div className="flex flex-col gap-8 pt-6">{children}</div>
    </section>
  )
}

/** A labelled specimen inside a section. The label is the eyebrow, never a heading. */
export function Specimen({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</h3>
        {note ? <p className="text-xs text-text-subtle">{note}</p> : null}
      </div>
      {children}
    </div>
  )
}

/** The neutral stage a specimen sits on — opaque, so a control is judged on its own material. */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('card-surface rounded-2xl p-5', className)}>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

/**
 * A lit ground for the glass specimens. Glass is only judgeable over something busy — on a flat
 * panel every weight looks identical — so this lays soft blurred pools of the theme's own accents
 * behind the content. It is a review stage, not a stand-in for the 3D universe, which is reviewed
 * against the real renderer rather than against an approximation of it.
 */
export function LitBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-bg p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-16 -z-10 size-64 rounded-full bg-primary opacity-30 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-0 -z-10 size-72 rounded-full bg-tertiary opacity-20 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/4 -z-10 size-40 rounded-full bg-secondary opacity-15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4">{children}</div>
    </div>
  )
}

/** A left-labelled row inside a stage, for matrices that read as label → examples. */
export function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-subtle">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/**
 * The interaction states of one control, side by side.
 *
 * `render(state)` is called once per state so each cell gets its own instance — the disabled and
 * loading cells need real props, while hover/focus/pressed are held by the design system's
 * state-preview wrappers rather than by a prop, so what is shown is the product's own rule.
 */
export type PreviewState = 'default' | 'hover' | 'focus' | 'pressed' | 'disabled' | 'loading'

const STATE_LABEL: Record<PreviewState, string> = {
  default: T.stateDefault,
  hover: T.stateHover,
  focus: T.stateFocus,
  pressed: T.statePressed,
  disabled: T.stateDisabled,
  loading: T.stateLoading,
}

const STATE_WRAPPER: Partial<Record<PreviewState, string>> = {
  hover: 'state-hover',
  focus: 'state-focus',
  pressed: 'state-pressed',
}

export function StateMatrix({
  states,
  render,
}: {
  states: readonly PreviewState[]
  render: (state: PreviewState) => ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      {states.map((state) => (
        <div key={state} className="flex flex-col items-start gap-2">
          <span className="text-xs uppercase tracking-wide text-text-subtle">
            {STATE_LABEL[state]}
          </span>
          <div className={STATE_WRAPPER[state]}>{render(state)}</div>
        </div>
      ))}
    </div>
  )
}

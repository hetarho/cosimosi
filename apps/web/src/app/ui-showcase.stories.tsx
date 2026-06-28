import { useState, type ReactNode } from 'react'

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  VisuallyHidden,
  useTheme,
} from '@cosimosi/ui'

// Dev surface to eyeball every primitive on web. The `.stories.tsx` name keeps its
// demo copy out of the i18n raw-string lint (product copy still flows through m.*).

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border py-6">
      <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

export function UiShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [checked, setChecked] = useState(true)
  const [on, setOn] = useState(false)
  const { theme, background, setBackground } = useTheme()

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-text">
      <h1 className="text-2xl font-semibold">@cosimosi/ui — web</h1>

      <Section title="Button">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="IconButton">
        <IconButton label="Add" icon={<PlusIcon />} variant="primary" />
        <IconButton label="Add" icon={<PlusIcon />} variant="secondary" />
        <IconButton label="Loading" icon={<PlusIcon />} loading />
        <IconButton label="Disabled" icon={<PlusIcon />} disabled />
      </Section>

      <Section title="Fields">
        <div className="w-64">
          <TextField label="Email" placeholder="you@example.com" description="Work address" />
        </div>
        <div className="w-64">
          <TextField label="Email" defaultValue="nope" error="Enter a valid email" />
        </div>
        <div className="w-64">
          <TextArea label="Note" placeholder="Write something…" />
        </div>
      </Section>

      <Section title="Toggles">
        <Switch label="Wi-Fi" checked={on} onCheckedChange={setOn} />
        <Switch label="Disabled" disabled />
        <Checkbox label="Subscribe" checked={checked} onCheckedChange={setChecked} />
        <Checkbox label="Disabled" disabled />
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Delete engram?"
          description="This cannot be undone."
          closeLabel="Close"
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDialogOpen(false)}>
              Delete
            </Button>
          </div>
        </Dialog>
        <Tooltip content="Saved to your universe">
          <Button variant="secondary">Hover me</Button>
        </Tooltip>
        <Button onClick={() => setToastOpen(true)}>Show toast</Button>
      </Section>

      <Section title="Status">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </Section>

      <Section title="Skeleton">
        <Skeleton width={200} height={16} />
        <Skeleton width={120} height={16} />
        <Skeleton width={48} height={48} rounded="full" />
      </Section>

      <Section title="Theme seam (presentation only)">
        <span className="text-sm text-text-muted">
          theme: {theme} · background: {background.tone}
        </span>
        <Button variant="secondary" onClick={() => setBackground({ tone: background.tone === 'cosmos' ? 'plain' : 'cosmos' })}>
          Toggle background
        </Button>
      </Section>

      <VisuallyHidden>End of showcase</VisuallyHidden>

      <div className="fixed right-4 bottom-4 w-72">
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" durationMs={3000}>
          Engram saved.
        </Toast>
      </div>
    </main>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  )
}

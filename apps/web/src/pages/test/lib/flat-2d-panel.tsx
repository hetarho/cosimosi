import { useState, type ReactNode } from 'react'

import { Badge, Button, IconButton, Switch } from '@cosimosi/ui'

// A composed screen built only from 2D primitives (no 3D) — a stand-in "memory detail"
// layout to judge hierarchy, spacing rhythm, and density on their own. Dev-only design
// showcase: its copy is mock/demo data (see ui-gallery-panel.tsx), intentionally outside
// the product i18n catalog; the real star-detail screen localizes copy through `m.*`.
const T = {
  back: 'Back',
  share: 'Share',
  more: 'More',
  universe: 'Universe',
  moodBadge: '기쁨',
  dateBadge: 'Year 1 · Day 12',
  title: 'A quiet afternoon by the window',
  meta: 'Recalled 3 times · last seen 4 days ago',
  body: 'The light came in ▓▓▓ warm across the desk, and for a moment ▓▓▓▓ nothing needed to be done. A cup of tea went cold while ▓▓▓▓▓ the page stayed open to the same line.',
  recall: '회고하기',
  history: '변천사',
  original: '원본 일기 보기',
  pin: 'Pin to constellation',
} as const

const STATS: readonly { label: string; value: string }[] = [
  { label: 'Strength', value: '0.62' },
  { label: 'Brightness', value: '0.90' },
  { label: 'Recall count', value: '3' },
  { label: 'Neurons', value: '7' },
]

export function Flat2dPanel() {
  const [starred, setStarred] = useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="ghost" label={T.back} icon={<Chevron />} />
          <span className="text-sm font-medium text-text-muted">{T.universe}</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton size="sm" variant="ghost" label={T.share} icon={<Dot />} />
          <IconButton size="sm" variant="ghost" label={T.more} icon={<Dot />} />
        </div>
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr_16rem]">
        <article className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{T.moodBadge}</Badge>
              <Badge variant="neutral">{T.dateBadge}</Badge>
            </div>
            <h2 className="text-2xl font-semibold text-text">{T.title}</h2>
            <p className="text-sm text-text-subtle">{T.meta}</p>
          </div>

          <p className="leading-7 text-text">{T.body}</p>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button>{T.recall}</Button>
            <Button variant="secondary">{T.history}</Button>
            <Button variant="ghost">{T.original}</Button>
          </div>
        </article>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            {STATS.map((stat) => (
              <Stat key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
            <span className="text-sm text-text">{T.pin}</span>
            <Switch ariaLabel={T.pin} checked={starred} onCheckedChange={setStarred} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  )
}

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Dot(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  )
}

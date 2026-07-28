import { Badge, defaultThemeKey, themes } from '@cosimosi/ui'

import { FoundationsPanel } from '../lib/foundations-panel.tsx'
import { PatternsPanel } from '../lib/patterns-panel.tsx'
import { PrimitivesPanel } from '../lib/primitives-panel.tsx'
import { SHOWCASE_GROUPS } from '../lib/showcase-sections.ts'
import { UniversePanel } from '../lib/universe-panel.tsx'
import { T } from '../lib/showcase-copy.ts'

/**
 * The design showcase — the surface a design review reads.
 *
 * It is the whole 2D language on one scrollable page, in the order a reviewer needs it: the tokens
 * first, then every primitive in every state, then the chrome those primitives compose into. One
 * page rather than a tab set, because the questions a review actually asks are comparisons across
 * sections — does the button's hover match the field's, does the list's density match the panel's —
 * and a tab hides the other half of every one of them.
 *
 * It is deliberately separate from `/test`: that surface verifies the platform wiring (transport,
 * cache, the live 3D universe) and answers "does it work", while this one answers "is it right".
 * Both sit behind the same diagnostics gate; neither ships to a user.
 */
export function DesignShowcasePage() {
  const activeTheme = themes[defaultThemeKey]
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto flex w-full max-w-7xl gap-10 px-4 py-10 lg:px-8">
        <ShowcaseNav />

        <div className="flex min-w-0 flex-1 flex-col gap-16">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{activeTheme.label}</Badge>
              <span className="text-xs text-text-subtle">{activeTheme.blurb}</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{T.title}</h1>
            <p className="max-w-measure text-base leading-7 text-text-muted">{T.subtitle}</p>
          </header>

          <FoundationsPanel />
          <PrimitivesPanel />
          <PatternsPanel />
          <UniversePanel />
        </div>
      </div>
    </main>
  )
}

// Plain anchors, not router links: the showcase is one document, so jumping inside it is the
// browser's job — and it keeps `pages` free of the routing seam.
function ShowcaseNav() {
  return (
    <nav
      aria-label={T.navLabel}
      className="sticky top-10 hidden h-fit w-48 shrink-0 flex-col gap-6 lg:flex"
    >
      {SHOWCASE_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {group.label}
          </span>
          {group.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {section.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}

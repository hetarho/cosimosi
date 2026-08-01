import { m } from '../../../../shared/i18n/index.ts'

// The first screen: one sentence, centered in a full viewport of the empty sky. The sky itself is
// the page-level backdrop (LandingBackdrop) — this section contributes only the words and the
// height that lets the sky be alone with them for one screen.
export function LandingHero() {
  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      {/* A soft local floor under the words only — not the whole viewport — so the headline stays
          legible over whichever sky the visitor gets while the sky stays bare around it. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-104 w-208 max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg/35 blur-3xl"
      />
      <div className="relative flex max-w-2xl flex-col items-center gap-5 text-center">
        <h1 className="text-3xl font-medium leading-tight text-text sm:text-4xl">
          {m.landing_hero_title()}
        </h1>
        <p className="text-base leading-7 text-text-muted">{m.landing_hero_body()}</p>
      </div>
      {/* The one gesture the layout asks for, said without words. */}
      <div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-text-subtle motion-safe:animate-bounce"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 6l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  )
}

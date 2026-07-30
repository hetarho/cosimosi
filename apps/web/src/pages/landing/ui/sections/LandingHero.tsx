import { m } from '../../../../shared/i18n/index.ts'
import { LandingHeroScene } from '../LandingHeroScene.tsx'

// The first screen: the empty sky behind, one sentence in front of it.
//
// The copy sits in normal document flow over an absolutely-positioned scene rather than inside the
// canvas, so it is on screen and readable at first paint — before WebGPU, and whether or not the canvas
// ever arrives.
export function LandingHero() {
  return (
    <section className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        <LandingHeroScene />
      </div>
      {/* A soft floor under the text so the headline stays legible over whichever sky the visitor gets. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/30 to-background"
      />
      <div className="relative flex max-w-2xl flex-col items-center gap-5 px-6 py-24 text-center">
        <h1 className="text-3xl font-medium leading-tight text-text sm:text-4xl">
          {m.landing_hero_title()}
        </h1>
        <p className="text-base leading-7 text-text-muted">{m.landing_hero_body()}</p>
      </div>
    </section>
  )
}

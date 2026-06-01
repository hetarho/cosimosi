import { NebulaBackground, Section } from '@/shared/ui'
import { HeroSection } from './sections/HeroSection'
import { ConceptSection } from './sections/ConceptSection'
import { EngramCard } from './sections/EngramCard'
import { HebbianCard } from './sections/HebbianCard'
import { TimeWindowCard } from './sections/TimeWindowCard'
import { ReconsolidationCard } from './sections/ReconsolidationCard'
import { SilentEngramCard } from './sections/SilentEngramCard'
import { NightlyConsolidationCard } from './sections/NightlyConsolidationCard'
import { HowItWorksSection } from './sections/HowItWorksSection'
import { ResonanceSection } from './sections/ResonanceSection'
import { CtaFooterSection } from './sections/CtaFooterSection'

export function LandingPage() {
  return (
    <div className="relative">
      <NebulaBackground />
      <main className="relative z-0">
        <HeroSection />
        <ConceptSection />

        <Section id="science">
          <header className="mb-12 text-center">
            <span className="text-xs uppercase tracking-widest text-mood-violet/80">Neuroscience</span>
            <h2 className="mt-3 font-display text-3xl text-white/90 sm:text-4xl">신경과학 토대</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
              cosimosi의 모든 동작은 기억에 관한 신경과학 이론에 매핑된다. 아래 각 개념을 직접 만져보세요.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2">
            <EngramCard />
            <HebbianCard />
            <TimeWindowCard />
            <SilentEngramCard />
            <div className="md:col-span-2">
              <ReconsolidationCard />
            </div>
            <div className="md:col-span-2">
              <NightlyConsolidationCard />
            </div>
          </div>
        </Section>

        <HowItWorksSection />
        <ResonanceSection />
        <CtaFooterSection />
      </main>
    </div>
  )
}

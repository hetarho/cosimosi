import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../model/theme'
import { LandingBackground } from './backgrounds/LandingBackground'
import { ThemeSwitcher } from './ThemeSwitcher'
import { JourneyAct } from './JourneyAct'
import { HeroSection } from './sections/HeroSection'
import { ConceptSection } from './sections/ConceptSection'
import { EngramCard } from './sections/EngramCard'
import { HebbianCard } from './sections/HebbianCard'
import { TimeWindowCard } from './sections/TimeWindowCard'
import { PresentSelfCard } from './sections/PresentSelfCard'
import { ReconsolidationCard } from './sections/ReconsolidationCard'
import { SilentEngramCard } from './sections/SilentEngramCard'
import { NightlyConsolidationCard } from './sections/NightlyConsolidationCard'
import { ResonanceSection } from './sections/ResonanceSection'
import { CtaFooterSection } from './sections/CtaFooterSection'

/**
 * 랜딩 = 별 하나가 태어나 살아가는 한 줄기 여정. 히어로에서 시작해 장(章)을 따라 내려가며
 * 엔그램 이론을 차례로 만진다 — 탄생(엔그램) → 연결(헵·시간 창) → 요즘의 나(경쟁적 할당) →
 * 재공고화 → 망각(침묵) → 야간 공고화 → 공명. 각 장은 JourneyAct가 같은 계층으로 그린다.
 */
export function LandingPage() {
  const theme = useLandingTheme((s) => s.theme)

  // data-landing-theme: index.css의 --ld-* 토큰(글래스·히어로·액센트 크롬)이 이 안에서만 적용된다.
  return (
    <div className="relative" data-landing-theme={theme}>
      <LandingBackground theme={theme} />
      <ThemeSwitcher />
      <main className="relative z-0">
        <HeroSection />

        <JourneyAct
          id="concept"
          chapter="I"
          eyebrow="여는 이야기"
          heading="뇌가 곧 우주"
          lead="기억 하나가 별이 되고, 닮은 기억끼리 빛의 선으로 이어져 작은 성단을 이룬다. 머릿속에만 펼쳐지던 그 풍경을, 눈에 보이는 우주로 옮겨 놓았다."
        >
          <ConceptSection />
        </JourneyAct>

        <JourneyAct
          id="engram"
          chapter="II"
          eyebrow="엔그램 · ENGRAM"
          heading="쓰는 순간, 별 하나가 태어난다"
          lead="뇌는 기억을 뉴런 다발에 새기고, 그 다발을 시냅스로 잇는다. cosimosi에선 일기 한 편이 별이 되고, 별과 별을 잇는 빛의 선이 그 시냅스다."
          accent={MOOD.violet}
          layout="split"
        >
          <EngramCard />
        </JourneyAct>

        <JourneyAct
          id="connect"
          chapter="III"
          eyebrow="헵 가소성 · 기억의 시간 창"
          heading="별과 별이, 빛으로 이어진다"
          lead="함께 떠올린 기억일수록 둘을 잇는 선이 굵어지고, 한동안 멀어지면 다시 가늘어진다. 그리고 그 인연은 대개 같은 하루 안에서 맺어진다 — 시간이 지나면 창은 닫힌다."
          accent={MOOD.teal}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <HebbianCard />
            <TimeWindowCard />
          </div>
        </JourneyAct>

        <JourneyAct
          id="present"
          chapter="IV"
          eyebrow="요즘의 나 · 경쟁적 할당"
          heading="지금의 내가, 우주를 물들인다"
          lead="별은 제자리에 머물지만, 그것을 비추는 빛은 요즘의 나를 따라 달라진다. 새로 쓴 기억은 빈 곳이 아니라 요즘 자주 머문 별무리 곁으로 끌려가 자리를 잡는다 — 어디 놓일지는 연결이 정한다."
        >
          <PresentSelfCard />
        </JourneyAct>

        <JourneyAct
          id="reconsolidation"
          chapter="V"
          eyebrow="재공고화 · RECONSOLIDATION"
          heading="떠올릴 때마다, 다시 빚어진다"
          lead="회상은 기억을 잠시 말랑하게 풀었다가 다시 굳힌다. 그 짧은 사이에 기억은 짙어지기도, 옅어지기도 한다. 그래서 cosimosi의 기억은 세 겹이다 — 내가 쓴 원본은 그대로, 별은 회상마다 다시 빚어지고, 변천사가 그 길을 남긴다."
          accent={MOOD.pink}
        >
          <ReconsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="silent"
          chapter="VI"
          eyebrow="침묵 엔그램 · 망각"
          heading="잊어도, 사라지지 않는다"
          lead="오래 떠올리지 않은 기억은 어두워질 뿐, 연결을 품은 채 그 자리에 남는다. 잊는다는 건 지우는 게 아니라 길을 잃는 일이다. 연결이 많은 별은 천천히, 홀로 떨어진 별은 빠르게 어두워진다."
          accent={MOOD.coral}
          layout="split"
          flip
        >
          <SilentEngramCard />
        </JourneyAct>

        <JourneyAct
          id="nightly"
          chapter="VII"
          eyebrow="야간 공고화 · 우주의 수면"
          heading="밤이 오면, 우주가 자리를 고른다"
          lead="잠든 사이 뇌는 낮에 담은 기억을 다시 깜빡이며 더 큰 자리로 옮기고, 흐릿한 디테일은 줄거리만 남기고, 약한 연결은 가만히 정리한다. 원본은 그대로 둔 채, 별자리만 다시 정돈되는 밤이다."
          accent={MOOD.violet}
        >
          <NightlyConsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="resonance"
          chapter="VIII"
          eyebrow="공명 · RESONANCE"
          heading="같은 밤, 두 개의 별"
          lead="같은 일도 두 사람의 우주엔 저마다의 별로 남는다. 친구가 그날을 자기 말로 다시 쓰면, 따로 빛나던 두 별이 하나의 빛줄기로 이어진다. 우리는 그걸 공명이라 부른다."
          accent={MOOD.amber}
        >
          <ResonanceSection />
        </JourneyAct>

        <CtaFooterSection />
      </main>
    </div>
  )
}

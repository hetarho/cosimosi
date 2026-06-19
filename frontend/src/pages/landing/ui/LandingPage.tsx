import { MOOD } from '@/shared/config'
import { CosmosScene, type StarVisual } from '@/widgets/cosmos-scene'
import { backgroundMeta, themeAccent, paletteForBackground, useAppearance } from '@/entities/appearance'
import { AppearanceSwitcher } from '@/features/switch-appearance'
import { JourneyAct } from './JourneyAct'
import { HeroSection } from './section/HeroSection'
import { ConceptSection } from './section/ConceptSection'
import { EngramCard } from './section/EngramCard'
import { FragmentationCard } from './section/FragmentationCard'
import { HebbianCard } from './section/HebbianCard'
import { TimeWindowCard } from './section/TimeWindowCard'
import { AmbientMoodCard } from './section/AmbientMoodCard'
import { PresentSelfCard } from './section/PresentSelfCard'
import { ReconsolidationCard } from './section/ReconsolidationCard'
import { SilentEngramCard } from './section/SilentEngramCard'
import { NightlyConsolidationCard } from './section/NightlyConsolidationCard'
import { ResonanceSection } from './section/ResonanceSection'
import { CtaFooterSection } from './section/CtaFooterSection'

/**
 * 랜딩 = 별 하나가 태어나 살아가는 한 줄기 여정. 히어로에서 시작해 장(章)을 따라 내려가며
 * 엔그램 이론을 차례로 만진다 — 탄생(엔그램) → 분할(사건 경계, 21) → 연결·강화(헵·시간 창)
 * → 재공고화 → 망각(침묵) → 요즘의 나(경쟁적 할당) → 야간 공고화 → 공명. 19–27 이론
 * 흐름과 같은 순서다(spec 19). 각 장은 JourneyAct가 같은 계층으로 그린다.
 */
export function LandingPage() {
  // data-theme(코스모스 색)은 RootLayout이 <html>에 앱 전역으로 박는다(appearance entity 구독).
  // 여기선 index.css의 --ld-* 글래스·히어로 크롬을 랜딩 안으로 한정하는 data-landing-theme만 둔다.
  const theme = useAppearance((s) => s.theme)
  const object = useAppearance((s) => s.object)
  // 히어로 엠블럼 별 — 페이지 전역 우주 씬(fixed)에 떠 있어 스크롤해도 배경에 남는다. 코어 작게, glow=halo.
  const heroStar: StarVisual = { concept: object, color: themeAccent(theme), anchor: [0.5, 0.32], size: 0.14, seed: 7 }
  // 랜딩은 배경 + 히어로 엠블럼 별만 그린다. 배경 결은 배경 번들의 veil 슬롯에서 바로 가져온다.
  const texture = backgroundMeta(theme).texture

  return (
    <div className="relative" data-landing-theme={theme}>
      {/* 페이지 전역 우주 배경(테마별 팔레트) — 구 LandingBackground(CSS+2D) 대체. 배경 + 히어로 별만. */}
      <div className="fixed inset-0 -z-10">
        <CosmosScene
          stars={[heroStar]}
          texture={texture}
          palette={paletteForBackground(theme)}
        />
      </div>
      <AppearanceSwitcher />
      <main className="relative z-0">
        <HeroSection />

        <JourneyAct
          id="concept"
          chapter="I"
          eyebrow="여는 이야기"
          heading="뇌가 곧 우주예요"
          lead="기억 하나가 별이 되고, 닮은 기억끼리 빛의 선으로 이어져 작은 성단이 돼요. 머릿속에만 펼쳐지던 풍경을, 눈에 보이는 우주로 옮겨 놓았어요."
        >
          <ConceptSection />
        </JourneyAct>

        <JourneyAct
          id="engram"
          chapter="II"
          eyebrow="엔그램 · ENGRAM"
          heading="쓰는 순간, 별 하나가 태어나요"
          lead="뇌는 기억을 뉴런 다발에 새기고, 그 다발을 시냅스로 이어요. cosimosi에선 일기 한 편이 별이 되고, 별과 별을 잇는 빛의 선이 그 시냅스예요."
          accent={MOOD.violet}
          layout="split"
        >
          <EngramCard />
        </JourneyAct>

        <JourneyAct
          id="fragmentation"
          chapter="III"
          eyebrow="사건 분할 · SEGMENTATION"
          heading="기억은 조각나요 — 하루가 여러 별로"
          lead="하루는 한 가지 감정이 아니에요. 아침의 평온, 낮의 분노, 밤의 안도 — AI가 일기를 사건의 경계에서 나누면, 조각마다 자기 감정을 가진 별이 태어나요. 같은 하루에서 갈라진 별들은 가장 강한 빛의 선으로 묶여요. 그리고 내가 쓴 원본은, 한 글자도 바뀌지 않은 채 그대로예요."
          accent={MOOD.coral}
          layout="split"
          flip
        >
          <FragmentationCard />
        </JourneyAct>

        <JourneyAct
          id="connect"
          chapter="IV"
          eyebrow="헵 가소성 · 기억의 시간 창"
          heading="별과 별이, 빛으로 이어져요"
          lead="함께 떠올린 기억일수록 둘을 잇는 선이 굵어지고, 한동안 떠올리지 않으면 그 빛이 옅어져요. 그리고 같은 하루 안에 맺어진 인연은 한층 더 또렷해요 — 날이 지나면 그 창은 닫혀요."
          accent={MOOD.teal}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <HebbianCard />
            <TimeWindowCard />
          </div>
        </JourneyAct>

        <JourneyAct
          id="reconsolidation"
          chapter="V"
          eyebrow="재공고화 · RECONSOLIDATION"
          heading="떠올릴 때마다, 다시 빚어져요"
          lead="회상은 기억을 잠시 말랑하게 풀었다가 다시 굳혀요. 그 짧은 사이에 기억은 짙어지기도, 옅어지기도 해요. 그래서 cosimosi의 기억은 세 겹이에요 — 내가 쓴 원본은 그대로, 별은 회상마다 다시 빚어지고, 변천사가 그 길을 남겨요."
          accent={MOOD.pink}
        >
          <ReconsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="silent"
          chapter="VI"
          eyebrow="침묵 엔그램 · 망각"
          heading="잊어도, 사라지지 않아요"
          lead="오래 떠올리지 않은 기억은 어두워질 뿐, 연결을 품은 채 그 자리에 남아요. 잊는다는 건 지우는 게 아니라 길을 잃는 일이에요. 어두워진 별도 회상 한 번이면 다시 깨어나요."
          accent={MOOD.coral}
          layout="split"
          flip
        >
          <SilentEngramCard />
        </JourneyAct>

        <JourneyAct
          id="present"
          chapter="VII"
          eyebrow="요즘의 나 · 경쟁적 할당"
          heading="지금의 내가, 우주를 물들여요"
          lead="별은 제자리에 머물지만, 그 별을 비추는 빛은 요즘의 나를 따라 달라져요. 같은 별들도 오늘의 하늘색이 다르면 다르게 보이죠. 그리고 새로 쓴 기억은 빈 곳이 아니라 요즘 자주 머문 별무리 곁으로 끌려가 자리를 잡아요 — 어디 놓일지는 연결이 정해요."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <AmbientMoodCard />
            <PresentSelfCard />
          </div>
        </JourneyAct>

        <JourneyAct
          id="nightly"
          chapter="VIII"
          eyebrow="야간 공고화 · 우주의 수면"
          heading="밤이 오면, 우주가 자리를 골라요"
          lead="잠든 사이 뇌는 낮에 담은 기억을 다시 깜빡이며 더 큰 자리로 옮겨요. 흐릿한 디테일은 줄거리만 남기고, 약한 연결은 가만히 정리해요. 원본은 그대로 둔 채, 별자리만 다시 정돈되는 밤이에요."
          accent={MOOD.violet}
        >
          <NightlyConsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="resonance"
          chapter="IX"
          eyebrow="공명 · RESONANCE"
          heading="같은 밤, 두 개의 별"
          lead="같은 일도 두 사람의 우주엔 저마다의 별로 남아요. 친구가 그날을 자기 말로 다시 쓰면, 따로 빛나던 두 별이 하나의 빛줄기로 이어져요. 우리는 그걸 공명이라 불러요."
          accent={MOOD.amber}
        >
          <ResonanceSection />
        </JourneyAct>

        <CtaFooterSection />
      </main>
    </div>
  )
}

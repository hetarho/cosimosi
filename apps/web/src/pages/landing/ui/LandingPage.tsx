import { MOOD } from '@/shared/config'
import { CosmosScene } from '@/widgets/cosmos-scene'
import { backgroundMeta, paletteForBackground, useAppearance } from '@/entities/appearance'
import { AppearanceSwitcher } from '@/features/switch-appearance'
import { useStage } from '../model/stage'
import { useStageProgress } from '../lib/use-stage-progress'
import { useStageCosmos } from '../lib/stage-projection'
import { JourneyAct } from './JourneyAct'
import { StageLayer } from './StageLayer'
import { HeroSection } from './section/HeroSection'
import { ConceptSection } from './section/ConceptSection'
import { FragmentationCard } from './section/FragmentationCard'
import { HebbianCard } from './section/HebbianCard'
import { ReconsolidationCard } from './section/ReconsolidationCard'
import { SilentEngramCard } from './section/SilentEngramCard'
import { PresentSelfCard } from './section/PresentSelfCard'
import { NightlyConsolidationCard } from './section/NightlyConsolidationCard'
import { ResonanceSection } from './section/ResonanceSection'
import { CtaFooterSection } from './section/CtaFooterSection'

/**
 * 랜딩 = 상단 고정 "무대(stage)" 1개 + 그 아래로 흐르는 스크롤 콘텐츠(change 31). 콘텐츠 장(章)의
 * 트리거(버튼/일기 UI)가 무대를 조작해 전체 뇌과학 아크를 시연한다 — 엔그램(뇌=우주) → 일기→별 분할 →
 * 헵·시간 창 → 재공고화 → 망각 → 요즘의 나(전역 물듦) → 야간 공고화 → 공명. 무대는 화면 밖으로 사라지지
 * 않으므로 인터랙션 결과가 늘 보인다. 테마 시스템(data-landing-theme·AppearanceSwitcher)은 현행 유지.
 */
export function LandingPage() {
  const theme = useAppearance((s) => s.theme)
  const object = useAppearance((s) => s.object)
  // 요즘의 나(present) 장이 고른 마음 — 랜딩 전역 배경을 그 감정으로 물들인다(장 벗어나면 null로 복귀).
  const bgMood = useStage((s) => s.bgMood)
  const texture = backgroundMeta(theme).texture
  // 무대 = 배경 CosmosScene에 떠 있는 진짜 3D 별 오브제(현재 룩). 히어로 진행도가 엠블럼을 중앙→상단으로 띄운다.
  const progress = useStageProgress()
  const { stars, synapses } = useStageCosmos(object, progress)

  return (
    <div className="relative" data-landing-theme={theme}>
      {/* 페이지 전역 우주 배경 + 무대 별/시냅스(상단 띠). 히어로 엠블럼·무대 별 모두 3D StarMesh로 그려진다. */}
      <div className="fixed inset-0 -z-10">
        <CosmosScene stars={stars} synapses={synapses} texture={texture} palette={paletteForBackground(theme)} />
      </div>
      {/* 요즘의 나 전역 물듦 — mood 색 한 겹을 배경 위에 올린다(무대 밖·루트까지). 장을 벗어나면 페이드아웃. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-700"
        style={{
          opacity: bgMood ? 1 : 0,
          background: bgMood
            ? `radial-gradient(120% 90% at 50% 18%, ${bgMood}38 0%, ${bgMood}14 42%, transparent 72%)`
            : undefined,
        }}
      />

      {/* 상단 고정 무대 + 히어로 엠블럼 전환. */}
      <StageLayer />

      <AppearanceSwitcher />

      <main className="relative z-0">
        <HeroSection />

        <JourneyAct
          id="concept"
          chapter="I"
          eyebrow="엔그램 · ENGRAM"
          heading="뇌가 곧 우주예요"
          lead="기억 하나가 별이 되고, 닮은 기억끼리 빛의 선으로 이어져 작은 성단이 돼요. 머릿속에만 펼쳐지던 풍경을, 눈에 보이는 우주로 옮겨 놓았어요."
        >
          <ConceptSection />
        </JourneyAct>

        <JourneyAct
          id="diary"
          chapter="II"
          eyebrow="부호화 · 사건 분할"
          heading="일기를 별로 나눠 우주에 띄워요"
          lead="하루는 한 가지 감정이 아니에요. AI가 일기를 사건의 경계에서 나누면, 조각마다 자기 감정을 가진 별이 태어나요. 같은 하루에서 갈라진 별들은 가장 굵은 빛의 선으로 묶이고, 내가 쓴 원본은 한 글자도 그대로예요."
          accent={MOOD.coral}
        >
          <FragmentationCard />
        </JourneyAct>

        <JourneyAct
          id="hebbian"
          chapter="III"
          eyebrow="헵 가소성 · 기억의 시간 창"
          heading="함께 떠올린 기억은 단단해져요"
          lead="함께 떠올린 기억일수록 둘을 잇는 선이 굵어지고, 자주 함께 떠올린 별은 서로 더 가까이 머물러요 — 거리가 곧 연결의 힘이에요. 같은 하루 안에 맺어진 인연은 시간 창이 열려 한층 또렷하고, 날이 지나면 그 창은 닫혀요."
          accent={MOOD.teal}
        >
          <HebbianCard />
        </JourneyAct>

        <JourneyAct
          id="reconsolidation"
          chapter="IV"
          eyebrow="재공고화 · RECONSOLIDATION"
          heading="떠올릴 때마다, 다시 빚어져요"
          lead="회상은 기억을 잠시 말랑하게 풀었다가 다시 굳혀요. 그 짧은 사이에 기억은 짙어지기도, 옅어지기도 해요. 내가 쓴 원본은 그대로, 별은 회상마다 다시 빚어지고, 변천사가 그 길을 남겨요."
          accent={MOOD.pink}
        >
          <ReconsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="forgetting"
          chapter="V"
          eyebrow="침묵 엔그램 · 망각"
          heading="잊어도, 사라지지 않아요"
          lead="오래 떠올리지 않은 기억은 어두워질 뿐, 연결을 품은 채 그 자리에 남아요. 잊는다는 건 지우는 게 아니라 길을 잃는 일이에요. 어두워진 별도 회상 한 번이면 다시 깨어나요."
          accent={MOOD.coral}
        >
          <SilentEngramCard />
        </JourneyAct>

        <JourneyAct
          id="present"
          chapter="VI"
          eyebrow="요즘의 나 · 경쟁적 할당"
          heading="지금의 내가, 우주를 물들여요"
          lead="별은 제자리에 머물지만, 그 별을 비추는 빛은 요즘의 나를 따라 달라져요. 마음을 고르면 우주 전체가 그 감정으로 물들고, 새로 쓴 기억은 요즘 자주 머문 별무리 곁으로 끌려가 자리를 잡아요 — 어디 놓일지는 연결이 정해요."
          accent={MOOD.amber}
        >
          <PresentSelfCard />
        </JourneyAct>

        <JourneyAct
          id="nightly"
          chapter="VII"
          eyebrow="야간 공고화 · 우주의 수면"
          heading="밤마다, 우주가 정리돼요"
          lead="잠든 사이 뇌는 낮의 별들을 다시 깜빡이며 정돈해요 — 가까운 별무리를 손보고, 잊혀가는 별은 줄거리만 남기고, 약한 선은 빛만 낮추되 별마다 하나는 지켜요. 원본은 그대로 둔 채, 별자리만 다시 정돈되는 밤이에요."
          accent={MOOD.violet}
        >
          <NightlyConsolidationCard />
        </JourneyAct>

        <JourneyAct
          id="resonance"
          chapter="VIII"
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

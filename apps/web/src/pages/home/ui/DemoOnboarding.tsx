// 데모 최초 온보딩(plan 47) — `/` 체험 진입이 자유모드(free)가 아니면 우주 셸 HUD 대신 먼저 뜨는
// 선택 화면이다. 우주 캔버스는 뒤에서 계속 돌고(언마운트 안 함), 그 위에 dim + 중앙 카드만 얹는다.
//   1) not_started     → "누구의 우주를 탐험해볼까요?" 세 페르소나 카드
//   2) persona_selected → "어떻게 둘러볼까요?" 튜토리얼 / 자유 탐험 선택
//   3) tutorial_tbd     → 튜토리얼 준비 중 안내(자유모드로 복귀)  ※ plan 48에서 실제 투어로 대체
// 기능 해설·단축키·이론 캐러셀은 여기 두지 않는다 — 선택 화면이다(plan 47 비목표).
import { ArrowLeft, Compass, Sparkles } from 'lucide-react'
import type { DemoFlow, DemoPersona } from '@/shared/lib/demo'
import type { DemoPersonaMeta } from '@/shared/lib/demo'

export interface DemoOnboardingProps {
  flow: DemoFlow
  persona: DemoPersona
  personaList: DemoPersonaMeta[]
  /** 페르소나 선택 → 데이터 출처 확정 + 모드 선택 단계로. */
  onSelectPersona: (id: DemoPersona) => void
  /** "자유롭게 탐험해보기" → flow=free, 자유모드 셸 진입. */
  onChooseFree: () => void
  /** "기능 하나하나 알아보기" → 튜토리얼 진입(plan 47: 준비 중 / plan 48: 스포트라이트 투어). */
  onChooseTutorial: () => void
  /** 준비 중/튜토리얼에서 모드 선택으로 되돌아간다. */
  onBackToModeSelect: () => void
}

const cardCls =
  'group w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40'

export function DemoOnboarding({
  flow,
  persona,
  personaList,
  onSelectPersona,
  onChooseFree,
  onChooseTutorial,
  onBackToModeSelect,
}: DemoOnboardingProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="체험 우주 시작"
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/65 px-6 py-10 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-7 text-center">
        {flow === 'not_started' && (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-2xl text-white/90 sm:text-3xl">
                누구의 우주를 탐험해볼까요?
              </h1>
              <p className="text-sm text-white/55">
                고른 사람의 일기로 빚은 기억의 우주를 둘러보게 돼요.
              </p>
            </header>
            <div className="flex w-full flex-col gap-3">
              {personaList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPersona(p.id)}
                  className={`${cardCls} ${p.id === persona ? 'border-white/30 bg-white/[0.08]' : ''}`}
                >
                  <span className="block text-base font-medium text-white/90">{p.label}</span>
                  <span className="mt-0.5 block text-sm text-white/50">{p.tagline}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {flow === 'persona_selected' && (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-2xl text-white/90 sm:text-3xl">어떻게 둘러볼까요?</h1>
              <p className="text-sm text-white/55">
                {personaList.find((p) => p.id === persona)?.label ?? '선택한'} 님의 우주가 준비됐어요.
              </p>
            </header>
            <div className="flex w-full flex-col gap-3">
              <button type="button" onClick={onChooseTutorial} className={cardCls}>
                <span className="flex items-center gap-2 text-base font-medium text-white/90">
                  <Sparkles className="size-4 text-amber-200/90" aria-hidden />
                  기능 하나하나 알아보기
                </span>
                <span className="mt-1 block text-sm text-white/50">
                  우주 안의 버튼을 하나씩 짚어주는 짧은 안내를 따라가요.
                </span>
              </button>
              <button type="button" onClick={onChooseFree} className={cardCls}>
                <span className="flex items-center gap-2 text-base font-medium text-white/90">
                  <Compass className="size-4 text-white/80" aria-hidden />
                  자유롭게 탐험해보기
                </span>
                <span className="mt-1 block text-sm text-white/50">
                  안내 없이 바로 우주를 만져보며 둘러봐요.
                </span>
              </button>
            </div>
          </>
        )}

        {flow === 'tutorial_tbd' && (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-2xl text-white/90 sm:text-3xl">
                안내 투어는 준비 중이에요
              </h1>
              <p className="text-sm text-white/55">
                기능을 하나씩 짚어주는 안내는 곧 만나볼 수 있어요. 먼저 자유롭게 둘러볼까요?
              </p>
            </header>
            <div className="flex w-full flex-col gap-3">
              <button type="button" onClick={onChooseFree} className={cardCls}>
                <span className="flex items-center gap-2 text-base font-medium text-white/90">
                  <Compass className="size-4 text-white/80" aria-hidden />
                  자유롭게 탐험해보기
                </span>
              </button>
              <button
                type="button"
                onClick={onBackToModeSelect}
                className="inline-flex items-center justify-center gap-1.5 text-sm text-white/50 transition hover:text-white/80"
              >
                <ArrowLeft className="size-4" aria-hidden />
                선택으로 돌아가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

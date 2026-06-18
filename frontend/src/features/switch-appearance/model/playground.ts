// 플레이그라운드 미니 코스모스 어댑터(spec 44 §H, A12) — 미인증 랜딩·사인인·초대 3개 페이지가 공유한다.
// appearance 선택(4축)에서 CosmosScene의 self(나 앵커)·synapses(시냅스 표본)·texture(배경 결)를 파생해
// 중복을 없앤다. 배경 palette·히어로 별은 페이지가 직접 두고(기존), 어댑터는 새 두 축 + 배경 텍스처만 만든다.
// 위젯(CosmosScene)을 import하지 않는다(FSD: feature는 widget을 못 가져온다) — 반환 모양이 CosmosScene
// prop과 *구조적으로* 일치해 페이지가 그대로 펼친다. entity 타입(SelfObject·SynapseStyle)을 써서 정확히 맞춘다.
import { useAppearance, backgroundMeta, themeAccent, type SelfObject } from '@/entities/appearance'
import { type SynapseStyle } from '@/entities/synapse'
import { MOOD } from '@/shared/config'

export interface PlaygroundSelf {
  concept: SelfObject
  color: string
  anchor: [number, number]
  size: number
  seed?: number
}

export interface PlaygroundSynapse {
  a: [number, number]
  b: [number, number]
  colorA: string
  colorB: string
  weight: number
  style?: SynapseStyle
}

export interface PlaygroundExtras {
  self: PlaygroundSelf
  synapses: PlaygroundSynapse[]
  texture?: { veilColor?: string; veilOpacity?: number }
}

// 고정 표본 엣지(정규화 스크린 앵커 [0..1]) — 시냅스 스타일 전환을 라이브로 보여준다. 색은 양끝 mood.
const SAMPLE_EDGES: Omit<PlaygroundSynapse, 'style'>[] = [
  { a: [0.3, 0.62], b: [0.5, 0.5], colorA: MOOD.violet, colorB: MOOD.teal, weight: 0.62 },
  { a: [0.5, 0.5], b: [0.7, 0.6], colorA: MOOD.teal, colorB: MOOD.amber, weight: 0.5 },
]

/** 미니 코스모스의 self·synapses·texture를 현재 appearance 선택에서 파생한다(반응형 — 스위처로 바꾸면
 *  즉시 반영, A12). self 색은 배경 accent placeholder(미인증은 ambient 데이터 없음 — SelfStar no-data 폴백 동형). */
export function usePlaygroundExtras(): PlaygroundExtras {
  const theme = useAppearance((s) => s.theme)
  const selfObject = useAppearance((s) => s.selfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const accent = themeAccent(theme)
  return {
    self: { concept: selfObject, color: accent, anchor: [0.5, 0.5], size: 0.16, seed: 7 },
    synapses: SAMPLE_EDGES.map((e) => ({ ...e, style: synapseStyle })),
    texture: backgroundMeta(theme).texture,
  }
}

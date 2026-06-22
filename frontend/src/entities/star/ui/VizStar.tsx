import { CrystalStar, NebulaStar, LiquidStar, EmberStar, type StarVisualProps } from './svg'
import { decodeStarSelection, type StarSurface } from '../model/forms'

export interface VizStarProps extends StarVisualProps {
  /** 별 스킨 선택 — 합성 wire id "<form>+<surface>"(레거시 단일 id도 허용). 2D는 표면(surface)으로 대표
   *  SVG를 고른다(3D만큼 조합 폭이 없는 근사 프리뷰). */
  concept: string
}

/** 표면(surface) → 2D SVG 대표 오브제. 3D form×surface 조합을 2D 4종으로 근사하는 프리뷰 매핑(spec 52). */
const SVG_BY_SURFACE: Record<StarSurface, 'crystal' | 'nebula' | 'liquid' | 'ember'> = {
  facet: 'crystal',
  glossy: 'liquid',
  lava: 'ember',
  cloud: 'nebula',
  pulse: 'crystal',
}

/**
 * 별 하나를 '빛'으로 그리는 SVG 프리미티브(2D 렌더) — 합성 선택을 디코드해 표면별로 다른 오브제로 dispatch:
 *  facet → 크리스털 · glossy → 액체 구슬 · lava → 잉걸불 · cloud → 성운 · pulse → 크리스털.
 * 어떤 svg viewBox 안에든 (cx,cy,r)로 박힌다. 의미 색(mood hex)은 스킨이 바뀌어도 보존되고, 같은 seed면
 * 항상 같은 형태다.
 */
export function VizStar({ concept, ...rest }: VizStarProps) {
  const { surface } = decodeStarSelection(concept)
  switch (SVG_BY_SURFACE[surface]) {
    case 'nebula':
      return <NebulaStar {...rest} />
    case 'liquid':
      return <LiquidStar {...rest} />
    case 'ember':
      return <EmberStar {...rest} />
    case 'crystal':
    default:
      return <CrystalStar {...rest} />
  }
}

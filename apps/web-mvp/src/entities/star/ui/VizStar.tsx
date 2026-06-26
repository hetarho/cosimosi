import { CrystalStar, LiquidStar, EmberStar, type StarVisualProps } from './svg'
import { parseStarLook, type StarLook } from '../model/forms'

export interface VizStarProps extends StarVisualProps {
  /** 별 룩(단일 축, change 29). 2D는 룩별 대표 SVG로 근사한다(3D 단계 변형 없는 프리뷰). */
  concept: string
}

/** 룩 → 2D SVG 대표 오브제(근사 프리뷰): polyhedron → 크리스털 · liquid → 액체 구슬 · spiky → 잉걸불. */
const SVG_BY_LOOK: Record<StarLook, 'crystal' | 'liquid' | 'ember'> = {
  polyhedron: 'crystal',
  liquid: 'liquid',
  spiky: 'ember',
}

/**
 * 별 하나를 '빛'으로 그리는 SVG 프리미티브(2D 렌더) — 룩을 파싱해 대표 오브제로 dispatch.
 * 어떤 svg viewBox 안에든 (cx,cy,r)로 박힌다. 의미 색(mood hex)은 룩이 바뀌어도 보존된다.
 */
export function VizStar({ concept, ...rest }: VizStarProps) {
  switch (SVG_BY_LOOK[parseStarLook(concept)]) {
    case 'liquid':
      return <LiquidStar {...rest} />
    case 'ember':
      return <EmberStar {...rest} />
    case 'crystal':
    default:
      return <CrystalStar {...rest} />
  }
}

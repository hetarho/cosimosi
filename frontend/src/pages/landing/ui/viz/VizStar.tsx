import type { VizConcept } from './viz-concept'
import { CrystalStar, NebulaStar, LiquidStar, EmberStar, type StarVisualProps } from './stars'

export interface VizStarProps extends StarVisualProps {
  /** 시각 언어(= 랜딩 테마). 테마마다 완전히 다른 별 오브제로 그려진다. */
  concept: VizConcept
}

/**
 * 별 하나를 '빛'으로 그리는 SVG 프리미티브 — 테마마다 완전히 다른 오브제로 dispatch한다:
 *  - deepfield → 크리스털(회절 스파이크 + 보석 패싯)
 *  - aurora    → 성운(흐르는 빛구름)
 *  - liquid    → 유리 액체 구슬(굴절·스페큘러)
 *  - ember     → 잉걸불(용암 균열 + 백열 코어)
 * 어떤 svg viewBox 안에든 (cx,cy,r)로 박힌다. 의미 색(mood hex)은 테마가 바뀌어도 보존되고,
 * 같은 seed면 항상 같은 형태다. ("기억마다 하나뿐인 형태가 의미에서 창발한다"의 SVG 증명.)
 */
export function VizStar({ concept, ...rest }: VizStarProps) {
  switch (concept) {
    case 'aurora':
      return <NebulaStar {...rest} />
    case 'liquid':
      return <LiquidStar {...rest} />
    case 'ember':
      return <EmberStar {...rest} />
    case 'deepfield':
    default:
      return <CrystalStar {...rest} />
  }
}

// Public API for the star entity — 별의 도메인 단일 출처: 고를 수 있는 종류 + 종류별 렌더(3D/2D).
//  - 종류:    StarObject(type), STAR_OBJECTS(목록), DEFAULT_OBJECT
//  - 3D:     StarField(인스턴스, 우주), buildSingleStar(단일 몸체) — halo·합성은 소비처 몫
//  - 2D:     VizStar(SVG), StarVisualProps
export type { StarObject, StarObjectMeta } from './model/types'
export { STAR_OBJECTS, DEFAULT_OBJECT } from './model/kinds'
export { StarField, type StarFieldProps } from './ui/StarField'
export { buildSingleStar, type SingleStarBuild } from './model/single'
export { VizStar, type VizStarProps } from './ui/VizStar'
export type { StarVisualProps } from './ui/svg/types'

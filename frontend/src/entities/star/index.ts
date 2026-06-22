// Public API for the star entity — 별의 도메인 단일 출처: 고를 수 있는 종류 + 종류별 렌더(3D/2D).
//  - 종류:    StarObject(type), STAR_OBJECTS(목록)
//  - 3D:     StarField(인스턴스, 우주), buildStarBody(별-바디 프리미티브) + STAR_FORM_SPIN — 입력 바인딩
//            (attribute/uniform)은 소비처가, halo·캔버스·배치·움직임도 소비처 몫
//  - 2D:     VizStar(SVG), StarVisualProps
export type { StarObject, StarObjectMeta } from './model/types'
export { STAR_OBJECTS, isStarObject, parseStarObject } from './model/kinds'
// 형태×표면 2축 스킨(spec 52) — 카탈로그·디컴포지션·합성 인코딩.
export {
  type StarForm,
  type StarSurface,
  type StarSelection,
  type StarSkinMeta,
  STAR_FORMS,
  STAR_SURFACES,
  STAR_PRESETS,
  DEFAULT_STAR_FORM,
  DEFAULT_STAR_SURFACE,
  DEFAULT_STAR_SELECTION,
  parseStarForm,
  parseStarSurface,
  encodeStarSelection,
  decodeStarSelection,
  normalizeStarSelection,
} from './model/forms'
export { StarField, type StarFieldProps } from './ui/StarField'
export {
  buildStarBody,
  STAR_FORM_SPIN,
  STAR_FORM_BUILDERS,
  STAR_SURFACE_BUILDERS,
  type StarShadeInputs,
  type StarLightParams,
  type StarBodyBuild,
} from './ui/star-body'
export { VizStar, type VizStarProps } from './ui/VizStar'
export type { StarVisualProps } from './ui/svg/types'

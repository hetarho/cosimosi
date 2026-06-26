// Public API for the star entity — 별의 도메인 단일 출처: 고를 수 있는 종류 + 종류별 렌더(3D/2D).
//  - 종류:    StarObject(type), STAR_OBJECTS(목록)
//  - 3D:     StarField(인스턴스, 우주), buildStarBody(별-바디 프리미티브) + STAR_FORM_SPIN — 입력 바인딩
//            (attribute/uniform)은 소비처가, halo·캔버스·배치·움직임도 소비처 몫
//  - 2D:     VizStar(SVG), StarVisualProps
export type { StarObject, StarObjectMeta } from './model/types'
export { STAR_OBJECTS, isStarObject, parseStarObject } from './model/kinds'
// 단일 축 형태(룩) 카탈로그(spec 53 / change 29) — 사용자가 고르는 단위. 렌더 (form,surface) 프리미티브는 내부 전용.
export {
  type StarLook,
  type StarLookMeta,
  STAR_LOOKS,
  DEFAULT_STAR_LOOK,
  DEFAULT_STAR_SELECTION,
  parseStarLook,
  normalizeStarLook,
} from './model/forms'
export { StarField, type StarFieldProps } from './ui/StarField'
export {
  buildStarBody,
  STAR_LOOK_SPIN,
  STAR_LOOK_BUILDERS,
  type StarShadeInputs,
  type StarLightParams,
  type StarFormParams,
  type StarBodyBuild,
} from './ui/star-body'
// 추상화 단계 버킷화 + buildStarBody용 단계별 형태 파라미터(change 29) — 우주·회상 포트레이트(32)·스튜디오 미리보기(33) 공유.
export { STAGE_MAX, STAGE_LEVELS, stageBucket, formParamsFor } from './ui/stage'
export { VizStar, type VizStarProps } from './ui/VizStar'
export type { StarVisualProps } from './ui/svg/types'
// 의미 색 보존 색 유틸 — 랜딩 무대 재공고화가 mood hue를 좁게 드리프트할 때 쓴다(색조만 이동, 계열 유지).
export { shiftHue } from './lib/color'

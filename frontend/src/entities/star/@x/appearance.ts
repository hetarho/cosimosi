// Cross-import public API (FSD `@x`) — entities/appearance 전용. appearance store가 '선택'으로
// 운반하는 별 종류 타입·목록 + 형태×표면 2축 스킨(spec 52) 카탈로그·합성 인코딩만 노출한다.
// appearance는 이 파일에서만 star를 가져온다.
export type { StarObject } from '../model/types'
export { STAR_OBJECTS, DEFAULT_OBJECT, isStarObject, parseStarObject } from '../model/kinds'
export {
  type StarForm,
  type StarSurface,
  type StarSelection,
  type StarSkinMeta,
  STAR_FORMS,
  STAR_SURFACES,
  DEFAULT_STAR_FORM,
  DEFAULT_STAR_SURFACE,
  DEFAULT_STAR_SELECTION,
  parseStarForm,
  parseStarSurface,
  encodeStarSelection,
  decodeStarSelection,
  normalizeStarSelection,
} from '../model/forms'

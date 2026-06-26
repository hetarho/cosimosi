// Cross-import public API (FSD `@x`) — entities/appearance 전용. appearance store가 '선택'으로
// 운반하는 별 형태(룩) 단일 축 카탈로그(spec 53 / change 29)와 정규화만 노출한다.
// appearance는 이 파일에서만 star를 가져온다.
export {
  type StarLook,
  type StarLookMeta,
  STAR_LOOKS,
  DEFAULT_STAR_LOOK,
  DEFAULT_STAR_SELECTION,
  parseStarLook,
  normalizeStarLook,
} from '../model/forms'

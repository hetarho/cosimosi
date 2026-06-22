// Cross-import public API (FSD `@x`) — entities/appearance 전용. appearance store가 '선택'으로
// 운반하는 별 종류 타입·목록만 노출한다. appearance는 이 파일에서만 star를 가져온다.
export type { StarObject } from '../model/types'
export { STAR_OBJECTS, DEFAULT_OBJECT, isStarObject, parseStarObject } from '../model/kinds'

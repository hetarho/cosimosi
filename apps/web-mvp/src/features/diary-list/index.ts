// Public API for the diary-list feature (spec 28 — 원본 일기 목록·검색 오버레이). Named exports
// only (FSD public-API rule). DiarySheet is CONTENT ONLY — HomePage composes it inside the
// universe shell's telescope explorer Surface and wires onSelectDiary to focus/frame behavior.
export { DiarySheet, type DiarySheetProps } from './ui/DiarySheet'
// 선택한 일기를 하단에 보여주는 카드 — 목록 peek 상태를 대신한다(spec 31).
export { DiaryCard, type DiaryCardProps } from './ui/DiaryCard'
// 순수 필터(change 09) — 일기 페이지·탐색 탭이 같은 검색·감정·날짜 로직을 공유한다.
export {
  filterDiaries,
  type DiaryFilterEntry,
  type DiaryFilterCriteria,
} from './model/filters'
// recordsQueryOptions/recordsInvalidateKey live in entities/memory (cross-layer consumers —
// DiarySheet reads, record-memory invalidates), like dormant/universe query options.

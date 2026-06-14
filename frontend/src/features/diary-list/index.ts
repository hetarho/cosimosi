// Public API for the diary-list feature (spec 28 — 원본 일기 목록·검색 오버레이). Named exports
// only (FSD public-API rule). The page composes DiarySheet over the universe canvas and wires
// onSelectDiary to useWayfindingStore.frameRecord (features don't import features).
export { DiarySheet, type DiarySheetProps } from './ui/DiarySheet'
// recordsQueryOptions/recordsInvalidateKey live in entities/memory (cross-layer consumers —
// DiarySheet reads, record-memory invalidates), like dormant/universe query options.

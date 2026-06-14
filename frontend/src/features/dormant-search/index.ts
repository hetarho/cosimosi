// Public API for the dormant-search feature (spec 12, overlay shell spec 31). Named exports
// only (FSD public-API rule). The page composes DormantSheet inside the universe shell's
// OverlayHost and wires onSelect → camera.focusStar + shell setPeek (features don't import
// widgets/features — the page composes). The query identity lives in entities/memory
// (dormantQueryOptions — shared with features/recall's invalidate); this feature owns only
// the DormantStar view-model select.
export { DormantSheet, type DormantSheetProps } from './ui/DormantSheet'
export { dormantStarsQueryOptions, type DormantStar } from './api/list-dormant'

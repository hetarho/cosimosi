// Bjork memory weight (spec 07) — storage strength S + retrieval strength R, the self-proximity
// radius input (38), and the background emotion ranking. The formulas are platform-independent
// pure math and now live in shared/lib (memory-physics) so the real renderer and the demo
// simulation import the SAME source (job 43 parity — no drift). This module re-exports them so the
// entities/memory public API and existing consumers (activation.ts, weight.test.ts) are unchanged.
export {
  storageStrength,
  retrievalStrength,
  memoryR,
  radiusConnectedness,
  memoryRadiusR,
} from '@/shared/lib'

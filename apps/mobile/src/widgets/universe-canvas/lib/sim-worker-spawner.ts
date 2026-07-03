import type {SimWorkerSpawner} from '@cosimosi/universe';

// React Native ships no standard Worker primitive, so the mobile bridge runs the inline
// JS-thread fallback — current universe graph sizes tick well within a frame there. When
// an RN worker primitive lands, it slots in behind this same spawner seam without
// touching the shared bridge, sim, or scene (the web sibling spawns a real module
// Worker here).
export function createSimWorkerSpawner(): SimWorkerSpawner | null {
  return null;
}

/**
 * @cosimosi/state-machine — platform-pure XState v5 catalog and helpers.
 *
 * Both apps/web and apps/mobile consume this package. It stays free of
 * React, three.js, and DOM/native deps; the React binding seam lives in each
 * app under shared/model. ARCHITECTURE §3.1, §3.2, §3.5.
 *
 * Catalog (this unit ships platform-level patterns; product workflows are
 * authored by their feature plans — non-goal of plan/07):
 * - sessionMachine (from @cosimosi/auth) — auth/session lifecycle reference.
 * - asyncCommandMachine — generic local-command lifecycle
 *   (idle → submitting → succeeded | failed | cancelled).
 * - panelMachine — overlay / test-harness panel lifecycle
 *   (closed → open → loading → ready | error).
 *
 * Placement rules (ARCHITECTURE §3.2; details in spec/tech/state-machine.md):
 * - app-wide lifecycle machines: apps/{web,mobile}/src/app/model
 * - feature action machines:    features/{verb}/model
 * - entity control machines:    entities/{noun}/model
 * - generic reusable patterns (this catalog): packages/state-machine
 *
 * Context rule — machines store ids/control metadata only. Forbidden in
 * context: server data collections, QueryClient/Zustand snapshots, graph
 * buffers, Float32Array coordinate data, Supabase session objects, or access
 * tokens. The data lives in Query/Zustand/refs and is selected by id.
 */
export {
  asyncCommandMachine,
  initialAsyncCommandSnapshot,
  type AsyncCommandEvent,
  type AsyncCommandSnapshot,
  type AsyncCommandStatus,
} from './async-command.machine.ts'
export {
  panelMachine,
  initialPanelSnapshot,
  type PanelEvent,
  type PanelSnapshot,
  type PanelStatus,
} from './panel.machine.ts'

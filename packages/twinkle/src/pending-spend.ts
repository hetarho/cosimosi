import { SpendKind } from '@cosimosi/api-client'

// The pending spend a cost display is asked to price ([G4]): only *what action on which
// target* — a recall or gist-view of one episodic memory (episodicMemoryId), or the
// whole-diary recall batch (diaryId, [D3]). The price, coverage, and shortfall are the
// server quote's; this carries no figure of its own (CC3 — the FE never prices).
export interface PendingSpend {
  readonly kind: SpendKind
  readonly episodicMemoryId?: string
  readonly diaryId?: string
  readonly semanticStage?: number
}

// A recall of one memory, priced by its decay depth (deeper decay → costlier, [G4][F4]).
export function recallSpend(episodicMemoryId: string): PendingSpend {
  return { kind: SpendKind.RECALL, episodicMemoryId }
}

// A gist-view quote carries the exact risen stage that the subsequent ViewSemantic call charges.
export function gistViewSpend(episodicMemoryId: string, semanticStage: number): PendingSpend {
  return { kind: SpendKind.GIST_VIEW, episodicMemoryId, semanticStage }
}

// The sum of a diary's recall costs ([D3]) — the batch quote the diary reader composes.
export function diaryRecallSpend(diaryId: string): PendingSpend {
  return { kind: SpendKind.DIARY_RECALL, diaryId }
}

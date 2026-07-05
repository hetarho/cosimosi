import type { Transport } from '@connectrpc/connect'

import { createMemoryClient, type SplitDiaryResponse } from '@cosimosi/api-client'

// A proposed memory as plain values, for the `previous` proposal sent back to the model.
export interface ProposedMemoryInput {
  readonly name: string
  readonly mood: string
  readonly neurons: readonly { readonly name: string; readonly type: string }[]
}

export interface ReviseSplitInput {
  readonly body: string
  readonly diaryDate: string
  /** The CURRENT (possibly hand-edited) proposal, so the model revises from where the user is. */
  readonly previous: readonly ProposedMemoryInput[]
  readonly instruction: string
}

// features/revise-split api: the natural-language re-run ([W4a]). It sends the current proposal +
// the user's instruction and returns the same schema-forced shape, which REPLACES the proposal —
// so hand-edit and NL edit converge on one result. Unary, no persistence (§2.7).
export async function requestReviseSplit(transport: Transport, input: ReviseSplitInput): Promise<SplitDiaryResponse> {
  return createMemoryClient(transport).reviseSplit({
    body: input.body,
    diaryDate: input.diaryDate,
    previous: {
      memories: input.previous.map((memory) => ({
        name: memory.name,
        mood: memory.mood,
        neurons: memory.neurons.map((neuron) => ({ name: neuron.name, type: neuron.type })),
      })),
    },
    instruction: input.instruction,
  })
}

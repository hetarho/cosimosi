import {
  createMemoryClient,
  type ApiTransport,
  type ViewSemanticResponse,
} from '@cosimosi/api-client'

// The gist (요지) the diarist chose to view ([R8]): the target memory, the risen stage, and the
// client operation id (idempotency, A2). Whether that stage has risen and what it costs are
// server-derived; the read spends Twinkle through the SpendGate and never rewrites ([I2]).
export interface ViewSemanticInput {
  readonly episodicMemoryId: string
  readonly stage: number
  readonly operationId: string
}

// The single synchronous ViewSemantic call (§2.7 unary): receipt check + spend + gist read commit
// atomically server-side, so the cost display fronts it (the quote) but never calls it — the
// composing panel fires this only after the cost gate proceeds, then refetches the balance. A
// response-loss retry with the same operation id replays the committed gist text without a second
// debit (A2/A3). Read-only: it returns the pregenerated stage text and reshapes nothing.
export async function requestViewSemantic(
  transport: ApiTransport,
  input: ViewSemanticInput,
): Promise<ViewSemanticResponse> {
  return createMemoryClient(transport).viewSemantic({
    episodicMemoryId: input.episodicMemoryId,
    stage: input.stage,
    operationId: input.operationId,
  })
}

import {
  createMemoryClient,
  type ApiTransport,
  type ViewSemanticResponse,
} from '@cosimosi/api-client'

// The gist (요지) the diarist chose to view ([R8]): the target memory and the risen stage
// — the only fields the client sends. Whether that stage has risen and what it costs are
// server-derived; the read spends Twinkle through the SpendGate and never rewrites ([I2]).
export interface ViewSemanticInput {
  readonly episodicMemoryId: string
  readonly stage: number
}

// The single synchronous ViewSemantic call (§2.7 unary): the spend + the gist read commit
// atomically server-side, so the cost display fronts it (the quote) but never calls it —
// the composing panel fires this only after the cost gate proceeds, then refetches the
// balance. Read-only: it returns the pregenerated stage text and reshapes nothing.
export async function requestViewSemantic(
  transport: ApiTransport,
  input: ViewSemanticInput,
): Promise<ViewSemanticResponse> {
  return createMemoryClient(transport).viewSemantic({
    episodicMemoryId: input.episodicMemoryId,
    stage: input.stage,
  })
}

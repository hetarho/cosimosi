import type { Transport } from '@connectrpc/connect'

import { createMemoryClient, type SplitDiaryResponse } from '@cosimosi/api-client'

export interface SplitDiaryInput {
  readonly body: string
  readonly diaryDate: string
}

// features/split-diary api: the synchronous SplitDiary preview (unary, §2.7). It returns the
// schema-forced 2–5 proposed memories and performs NO persistence — the proposal is edited
// in-session and only LaunchStars writes ([W2]). The proposal is shaped for the editable surface
// by the widget's proposal mappers (name / mood / neuron membership only — no position / color /
// strength / time can travel on this contract, §3.3).
export async function requestSplitDiary(transport: Transport, input: SplitDiaryInput): Promise<SplitDiaryResponse> {
  return createMemoryClient(transport).splitDiary({ body: input.body, diaryDate: input.diaryDate })
}

import { useCallback } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQueryClient } from '@tanstack/react-query'

import { claimAchievement, createAchievementServiceQueryKey } from '@cosimosi/api-client'

// The one write. The request carries the achievement id and NOTHING else — no amount, no ornament, no
// counter — so a client cannot propose what it earned; the reward comes back resolved.
export interface ClaimOutcome {
  grantedTwinkle: number
  grantedOrnamentId: string
  twinkleTotal: number
}

// This hook invalidates ONLY the achievement read. The balance and — for an ornament reward — the
// decoration catalog are invalidated by the feature that composes the reveal, which is what keeps this
// package free of a `@cosimosi/store` dependency it would otherwise need for one query key.
export function useClaimAchievement() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  return useCallback(
    async (achievementId: string): Promise<ClaimOutcome> => {
      const response = await claimAchievement(transport, { achievementId })
      await queryClient
        .invalidateQueries({ queryKey: createAchievementServiceQueryKey() })
        .catch(() => undefined)
      return {
        grantedTwinkle: Number(response.grantedTwinkle),
        grantedOrnamentId: response.grantedOrnamentId,
        twinkleTotal: Number(response.twinkleTotal),
      }
    },
    [queryClient, transport],
  )
}

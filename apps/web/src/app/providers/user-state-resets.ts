import { resetMoodPalette } from '@cosimosi/emotion'
import { resetOnboardingUserState } from '@cosimosi/onboarding'
import { resetSequenceUserState } from '@cosimosi/sequence'
import { resetStoreUserState } from '@cosimosi/store'
import { resetTwinkleUserState } from '@cosimosi/twinkle'
import { resetUniverseUserState } from '@cosimosi/universe'

// Product state belongs to app composition; auth owns only its own session state.
export const WEB_USER_STATE_RESETS = [
  { name: 'universe', reset: resetUniverseUserState },
  { name: 'twinkle', reset: resetTwinkleUserState },
  { name: 'palette', reset: resetMoodPalette },
  { name: 'store', reset: resetStoreUserState },
  { name: 'sequence', reset: resetSequenceUserState },
  { name: 'onboarding', reset: resetOnboardingUserState },
] as const

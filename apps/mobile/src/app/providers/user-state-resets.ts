import { resetSignupUserState } from '@cosimosi/account'
import { resetMoodPalette } from '@cosimosi/emotion'
import { resetOnboardingUserState } from '@cosimosi/onboarding'
import { resetSequenceUserState } from '@cosimosi/sequence'
import { resetStoreUserState } from '@cosimosi/store'
import { resetTwinkleUserState } from '@cosimosi/twinkle'
import { resetUniverseUserState } from '@cosimosi/universe'

import { resetMobileLocaleUserState } from '../../shared/native/locale-storage.ts'

// Product state belongs to app composition; auth owns only its own session state.
export const MOBILE_USER_STATE_RESETS = [
  { name: 'universe', reset: resetUniverseUserState },
  { name: 'twinkle', reset: resetTwinkleUserState },
  { name: 'palette', reset: resetMoodPalette },
  { name: 'store', reset: resetStoreUserState },
  { name: 'sequence', reset: resetSequenceUserState },
  { name: 'onboarding', reset: resetOnboardingUserState },
  { name: 'signup-completion', reset: resetSignupUserState },
] as const

// The platform leg runs last, after auth's own: the device locale is what a signed-out app speaks.
export const MOBILE_LOCALE_RESET = { name: 'locale', reset: resetMobileLocaleUserState } as const

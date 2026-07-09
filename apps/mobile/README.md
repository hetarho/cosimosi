# @cosimosi/mobile

React Native mobile shell for the clean platform. The shell is present in Phase 1; feature UI and renderer work arrive
with later product slices.

## Commands

| Command                                    | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `pnpm --filter @cosimosi/mobile start`     | Start Metro                                    |
| `pnpm --filter @cosimosi/mobile ios`       | Launch the iOS app                             |
| `pnpm --filter @cosimosi/mobile android`   | Launch the Android app                         |
| `pnpm --filter @cosimosi/mobile lint`      | Run React Native ESLint on the host            |
| `pnpm --filter @cosimosi/mobile typecheck` | Run TypeScript on the host without an emulator |

The quality gate is host-only: lint and typecheck do not boot iOS or Android.

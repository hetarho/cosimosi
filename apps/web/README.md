# @cosimosi/web

React 19 + Vite web shell for the clean platform.

## Commands

| Command                                             | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `pnpm --filter @cosimosi/web dev`                   | Start Vite locally                                        |
| `pnpm --filter @cosimosi/web lint`                  | Run oxlint, Steiger FSD checks, and ESLint boundaries     |
| `pnpm --filter @cosimosi/web typecheck`             | Run `tsc -b`                                              |
| `pnpm --filter @cosimosi/web test`                  | Run Vitest in host-only mode                              |
| `pnpm --filter @cosimosi/web build`                 | Typecheck and build the Vite app                          |
| `pnpm --filter @cosimosi/web lint:boundaries:probe` | Verify that a deliberate forbidden FSD layer import fails |

The web FSD boundary is intentionally active before feature slices exist. The current app shell is small, and later
slices inherit the same one-way layer rule as they appear.

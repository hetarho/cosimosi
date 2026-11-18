<!-- gusta:begin managed by gusta: do not edit inside this block (gusta-update rewrites it with "gusta agent-block"); write project rules outside it -->
## GUSTA

This project is built spec-first with GUSTA. `spec/` is the source of truth and code follows it.

- Implement only on a child branch; `gusta-start`, `gusta-self-improve` and `gusta-self-improve-remote` require a dedicated worktree. Plan with `gusta-plan`.
- Do not change behavior covered by a `spec/ssot/` decision without updating the spec first.
- Branch, push, deploy and version behavior comes from `spec/SETTINGS.md` (the `gusta-preference` skill); never assume branch names.

<!-- gusta:end -->

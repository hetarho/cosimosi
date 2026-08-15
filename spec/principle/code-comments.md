# Principle — Comments explain the code, not its history

A comment exists to help a reader understand the code in front of them. Nothing else.

## Rules

- **Explain what is non-obvious now** — an invariant the code must keep, a platform constraint, a boundary rule, a
  subtle reason the code _must_ be this way.
- **Never record process or history** — no "changed from X", "we chose A over B", plan/job/change/review numbers,
  finding IDs, dated notes, TODO-with-a-story, or decision logs. Git history and the spec own that.
- **Do not use bare plan-document anchors** — numeric links such as `[64]` decay when documents move or archive.
  Requirement IDs such as `[I2]`, `[V3]`, and `[P4]` remain valid because they name enduring rules.
- **Keep traceability out of prose comments** — comment-to-spec tracing, when reintroduced, must use a dedicated
  mechanism rather than fragile document numbers embedded in source.
- **If a comment would only make sense to someone who watched it being written, delete it.**

## Why

Same spirit as [timeless-documents.md](timeless-documents.md): the artifact must read correctly cold. A comment that
narrates the past adds noise the next reader must wade through, and goes stale the moment the code moves on.

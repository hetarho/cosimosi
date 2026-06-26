# Principle — Comments explain the code, not its history

A comment exists to help a reader understand the code in front of them. Nothing else.

## Rules

- **Explain what is non-obvious now** — an invariant the code must keep, a platform constraint, a boundary rule, a
  subtle reason the code *must* be this way.
- **Never record process or history** — no "changed from X", "we chose A over B", change/ticket numbers, dated notes,
  TODO-with-a-story, or decision logs. Git history and the spec own that.
- **If a comment would only make sense to someone who watched it being written, delete it.**

## Why

Same spirit as [timeless-documents.md](timeless-documents.md): the artifact must read correctly cold. A comment that
narrates the past adds noise the next reader must wade through, and goes stale the moment the code moves on.

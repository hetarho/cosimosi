# Principle — Documents are timeless and self-contained

Every document under `spec/` states **what is true now**, as a complete statement that reads correctly whenever it is
opened — by anyone, cold, with no knowledge of how it came to be.

## Rules

- **No process, no history.** Never write "we decided", "this reverses an earlier plan", "previously X", "in this
  pass", "renamed from Y", "MVP used to…", changelogs, or migration narratives. That belongs to git, not the document.
- **No dependence on transient context.** A reader opening the file after a rewrite, after old code is deleted, or
  months later must understand it without any backstory. If a sentence only makes sense to someone who watched it being
  written, it does not belong.
- **State the rule, not the journey to it.** Rationale appears only where a reader needs it to *avoid breaking the
  rule* (a live constraint) — never as a record of deliberation or rejected alternatives.
- **One responsibility per document; reference, don't duplicate.** Each doc owns its content and the others point to
  it. Restating another doc's content is drift waiting to happen.

## Why

A spec is read far more often than it is written, and almost always out of the context that produced it. History and
decision-making live in git and in the conversations that made them; the document is the settled result.

# policy: encode boundary

> Product policy for the diary→memory encode boundary ([W4a][E10]). Plan
> [20](../plan/20.encode-usecase.md) owns the implemented source (`internal/memory` `Encode`/`ReviseSplit`/
> `PersistEncoded`); plan [22](../plan/22.ai-worker-pipeline.md) owns the concrete extractor adapters.

## Rule 1 — The encode output is schema-forced ([W4a])

The LLM behind the `Extractor` port emits **only** `{memories:[{name, mood, source_text, neurons:[{name, type}]}]}` —
at the provider call (JSON-schema-forced output), on the RPC wire (`memory.v1` `SplitDiaryResponse`), and in the
domain DTO (`ExtractResult`). No position, color, strength, seed, time, or delete field exists in any of the three
shapes.

This is the structural half of the double defense: even if a prompt injection defeats the prompt engineering, the
model has no field in which to emit an invariant-violating value — no coordinate ([I3][I5]), no delete ([I1]), no
clock value ([I10]). Strong prompt engineering (event-boundary split, conservative merge) is the second half and is
owned by the extractor adapter's prompt.

### Must hold

- Any new field added to the encode schema must be justified against this rule; fields that could carry position,
  color, strength, seed, time, or deletion semantics are rejected by design review, not by validation code.
- Invariant enforcement on the returned structure (count range [E2], ≥1 semantic neuron [E4], typed neurons [E3])
  lives in the use-case as **retry/repair** — never a silent clamp and never an injected placeholder neuron. The
  repair budget is `encode.max_revise_retries`; the output budget is `encode.max_output_tokens`; exhausting either
  returns a canonical error.

## Rule 1a — The one prose field is verified against the diary, not trusted ([W4a])

`source_text` — the passage of the diary a memory was encoded from — is the only free text the encode schema carries.
A schema cannot constrain prose, so this field is the exception that proves Rule 1: it is bounded by a **structural
check in the domain** instead. Every token must be traceable to the writer's diary, so the worst a prompt injection
can do is echo the writer back at themselves.

- **The prompt half** owns the passage rules: quote the diary in the writer's own words; you may fix an obvious typo
  and repair the ending left dangling where you cut ("…발을 디뎠고," → "…발을 디뎠다."); you may not substitute a
  synonym, rephrase, summarize, reorder, add a transition, or invent. The passages follow the diary's order, do not
  overlap, and together account for the whole entry.
- **The structural half** owns token traceability (`internal/memory/sourcetext.go`, pure): a passage token is
  verbatim, or within `encode.source_text_max_repair_edit_distance` of a diary token **while sharing its first rune**
  — a repair keeps the head of the word, a substitution does not — with non-verbatim tokens budgeted by
  `encode.source_text_max_repaired_ratio`; and the passages jointly cover `encode.source_text_min_coverage` of the
  diary's tokens. A failure is repairable through the same `ReviseSplit` loop, not a clamp.
- **The check constrains the extractor, and only the extractor.** It does not re-run at `PersistEncoded`, where a
  passage may already be the writer's own edit. The line is drawn where the threat is: the model can silently rewrite
  the writer, so the model is verified; the writer cannot be wrong about their own words. What persist re-validates
  is structural — present, non-blank, no longer than the submitted body.

## Rule 2 — Neuron dedup is conservative and type-differentiated ([E10])

Dedup is an **identity judgement** ("is this the same neuron the user already has?"), performed by the extractor
against a per-user candidate set and honored at persist time by exact (name, type) resolution. It is distinct from
similarity _linking_ ([L3]): merging decides sameness, it never creates an edge.

- **entity** — same person/proper referent merges ("엄마" / "어머니" → one neuron).
- **spatial** — true aliases only, granularity preserved ("스타벅스" ≠ "스타벅스 강남점").
- **semantic** — strictest ("성취감" → "성취" may merge; "성취" ≠ "성공").

The embedding nearest-neighbour lookup is a **narrow assist** for candidate discovery only —
`encode.dedup_similarity_threshold` (cosine) and `encode.dedup_top_k` bound it (and the name-in-body match is bounded
by `encode.dedup_body_match_limit`); the merge decision is the extractor's conservative canonicalization, never a raw
similarity cutoff. Over-merging collapses the constellation, so the bias
is always toward keeping related-but-distinct concepts separate.

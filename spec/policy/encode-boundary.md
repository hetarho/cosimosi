# policy: encode boundary

> Product policy for the diary→memory encode boundary ([W4a][E10]). Plan
> [20](../plan/20.encode-usecase.md) owns the implemented source (`internal/memory` `Encode`/`ReviseSplit`/
> `PersistEncoded`); plan [22](../plan/22.ai-worker-pipeline.md) owns the concrete extractor adapters.

## Rule 1 — The encode output is schema-forced ([W4a])

The LLM behind the `Extractor` port emits **only** `{memories:[{name, mood, neurons:[{name, type}]}]}` — at the
provider call (JSON-schema-forced output), on the RPC wire (`memory.v1` `SplitDiaryResponse`), and in the domain DTO
(`ExtractResult`). No position, color, strength, seed, time, or delete field exists in any of the three shapes.

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

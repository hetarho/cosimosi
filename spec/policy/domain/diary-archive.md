# policy/domain: diary archive

> Domain policy for archive search, filtering, chronological paging, release visibility, and calendar mood facts.
> Plan [68](../../plan/68.diary-search-and-filter.md) owns the implementation. This policy reinforces [I1], [I2],
> [I10], [I11], [D7]–[D12], and [X2].

## Search reads the immutable original only

The searchable text is `Diary.body` and nothing else. `EpisodicMemory.CurrentText`, `DecayStages`,
`SemanticStages`, provenance text, and neuron text are never matched, ranked, ordered by, or excerpted. Archive search
is a free read of the objective record; it cannot restore a forgotten representation or bypass the recall economy.
User `%`, `_`, and `\` characters are literal search text.

## Ordering and filtering preserve diary grain

Ordering is chronological on `(diary_date, id)`, newest or oldest. Relevance and similarity ranking do not exist. Date
bounds are inclusive. A diary matches a mood iff at least one of its live `EpisodicMemory` rows has that mood; the
predicate is an existence fact, not a representative-mood selection. A diary with no live memory matches no mood and
still appears when mood filtering is absent.

## Calendar mood is a colorless weighted fact

For each written day, the server sums `EffectiveStrength` by mood across live memories of visible diaries. The response
carries `(mood, weight)` only: no color and no diary id. Color blending and representative selection are client-side
projections. A written day with no live mood has an empty mood list; it is not labeled `NEUTRAL`.

Calendar pagination is ascending and day-grained. The server owns the page size, so one written day cannot be split
across pages and a client cannot request an unbounded page.

## Release visibility is reversible

A diary is invisible to list, search, filters, and calendar while its `release_groups` row exists. Visibility is an
anti-join on that ledger, never a copied `diaries.deleted_at` flag. Restore removes the group row, so every archive read
shows the diary again without another diary write.

## Archive reads are free and time-frozen

`GetDiaries` and `GetDiaryCalendar` write nothing, spend no Twinkle, and advance no universe time. They receive no
clock, `SpendGate`, or economy transaction. The separate whole-diary jump remains the only archive action that spends
and synchronizes time.

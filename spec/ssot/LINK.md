# LINK links & synapses
> r1 | how the neuron↔neuron synapse graph grows at launch and how synapse strength is seeded, potentiated, weakened and read, so constellations emerge without any memory↔memory edge

## decisions
- LINK-1 [o] neurons co-activated within one memory are always wired: every unordered pair of the memory's distinct neurons gets a synapse, n·(n−1)/2 edges ← Hebbian co-firing (Hebb 1949)
  - applies whether each neuron is new or reused; the pair always takes the same-memory tier →!LINK-10
  - a pair co-firing in several memories of one launch accumulates one co-activation per memory, and its `last_activated_universe_time` moves to the latest such memory's date
  - a memory with fewer than two neurons has no internal edge; it is still connected through sharing →~LINK-2
- LINK-2 [o] two memories that share a neuron are thereby connected: the shared neuron is the link, and no extra edge is created for the sharing
  - the connection is the neuron's `neuron_activations` membership, which `GetUniverse` returns and the layout pulls toward →=VIS
  - sharing arises only from dedup resolving to the same neuron →=ENC-10
- LINK-3 [o] no synapse is created or strengthened from embedding or semantic similarity: linking reads no `embeddings` row ← similarity edges collapse the constellations; they grow from neuron reuse instead
  - the graph grows only from reuse (LINK-2), co-firing (LINK-1) and the temporal bonus (LINK-4)
  - embeddings serve neuron identity only →~ENC-10
- LINK-4 [o] a pair that fires together again close in time is strengthened more: when this launch's co-firing memory lies within `synapse.temporal_window_days` of another memory that co-activated the same pair, `synapse.temporal_bonus` is added once ← co-allocation (Cai 2016)
  - the window is narrow and measured on the memories' dates (days apart, either direction); nothing is written onto a neuron →~ENC-6
  - a pair's first-ever co-firing takes no bonus; the bonus applies from the second in-window co-firing, on top of that launch's potentiation, saturating at the cap
  - anchored on this launch: a distant repeat of an old near-in-time cluster earns nothing
  - co-activations count live memories only (`deleted_at IS NULL`)
- LINK-5 [o] synapse strength is a stored base plus a read-time derivation: history (`co_activation_count`, `last_activated_universe_time`) is stored because it cannot be recomputed; the time-decayed effective strength is never stored
  - `EffectiveSynapseStrength(base, elapsedUniverseDays)` = base × (1 − `synapse.strength_decay_per_day`)^elapsed, elapsed counted in universe-days since `last_activated_universe_time` →=TIME-10
  - it equals the base at 0 days, is non-increasing, stays within 0..base, and never writes back
  - the stored `strength` is always the base, never an effective value
  - its live consumer is the client filament (width and glow) →=VIS-6; the Go copy is reserved for server-side gating
- LINK-6 [o] synapses exist only between neurons; no synapse ever joins two memories →=INV-6
  - one row per unordered neuron pair per user, canonical `neuron_a_id < neuron_b_id` →=MEM
- LINK-7 [o] "memories close in time gather" is never implemented as a memory↔memory attraction; it emerges from shared neurons, near seeds and the temporal bonus →=INV-4
  - shared neurons pull their memories together →~LINK-2; new neurons seed near their cluster →=ENC-7; near-in-time co-firing strengthens the synapses →~LINK-4
  - constellations are computed by the layout from shared neurons and synapse strength, never stored: no coordinate, cluster or memory↔memory row →=VIS
- LINK-8 [o] potentiation saturates: each co-firing raises the base by a share of the remaining headroom, `Potentiate(s, rate) = s + rate × (cap − s)` with `synapse.potentiation_rate` ← frequent pairs converge to the cap instead of running away
  - monotone non-decreasing, the step shrinks as strength grows, asymptotic to the cap, clamped against overshoot
  - every caller passes the single generated rate; varying it per signal would be a caller decision, never a formula change
  - a launch's repeat co-firing potentiates the stored base; recall's batch potentiation uses the same primitive →=RECALL-3
  - the upsert keeps a launch retry idempotent: the canonical pair advances one row, never a duplicate →=MEM
- LINK-9 [o] strength lives in 0..`synapse.strength_cap` (1.0), a single cap for every signal kind
  - per-signal differences come from initials (and a caller-chosen rate), never from a separate cap
  - every primitive clamps its result into 0..cap
- LINK-10 [o] a new synapse starts weak, tiered by why it formed: `synapse.initial_same_memory` > `synapse.initial_shared_neuron` > `synapse.initial_temporal`, all above 0 and below the cap ← meaning must accrue through repetition and proximity
  - only the same-memory tier seeds edges today: every pair wired at launch co-fires within a memory
  - the shared-neuron and temporal tiers are reserved for a cross-memory linker that does not exist; sharing needs no edge (LINK-2) and proximity is a bonus on an existing base (LINK-4)
- LINK-11 [o] linking runs synchronously inside `PersistEncoded`'s launch transaction, after the activation inserts and before the job enqueue ← the graph is a correctness fact of the write, so the next `GetUniverse` reads it consistently →=ENC
  - `Linker` is a required service dependency (`ErrLinkerRequired`): no composition root can launch without growing the graph
  - it makes no LLM or embedding call, and it only inserts or strengthens, never deletes →=INV-1
  - it reads through `LaunchTx` only: the stored bases of synapses whose both endpoints are among the launched neurons (one query) and the launched neurons' live memberships with their memory dates
  - the async `link` job kind is reserved and never enqueued; no refinement beyond the launched neurons runs →=AI
- LINK-12 [o] the plasticity primitives are pure scalar functions, written once in Go (`internal/memory/plasticity.go`) and mirrored in TypeScript (`packages/memory-logic/src/synapse-plasticity.ts`) →=ARCH
  - `Potentiate`, `Depress`, `Downscale`, `ApplyTemporalBonus`, `InitialStrength`, `EffectiveSynapseStrength`, and the closed `SignalKind` (`same_memory`, `shared_neuron`, `temporal`)
  - no clock, repository, transport, randomness or emotion input; formulas, curve shapes and clamps stay in code, only coefficients, the cap and initials live in `values.yaml`
  - golden parity: one shared fixture `apps/api/internal/memory/testdata/synapse-plasticity-golden.json` at tolerance 1e-9, read by the Go and TS tests (`pnpm test:api`, `pnpm --filter @cosimosi/memory-logic test`)
  - the link use-case re-implements no strength arithmetic, so the client mirror reproduces every stored base
- LINK-13 [o] associative LTD and homeostatic downscaling are separate primitives that never share an implementation →=INV-9
  - `Depress(strength, amount)` lowers one synapse by a caller-supplied amount, floored at 0; its callers are the release contribution weakening →=DEL-1
  - `Downscale` is the global sleep renormalization →!LINK-14; consolidation is its only caller, and which synapses sleep and how often →=CONSOL-4
  - recall's `Reinforce` is a batch use-case over `Potentiate`, not the primitive itself →=RECALL-3
  - the recall neighbour effect moves forgetting offsets, never synapse strength →=RECALL-5
- LINK-14 [o] `Downscale(strength, factor)` takes a loss share that shrinks toward the cap, loss = factor × (1 − (strength ÷ cap)^`consolidation.downscale_weak_bias`), and returns strength × (1 − loss) ← keep signal, prune noise: weak edges lose proportionally more, strong edges are spared
  - inputs are clamped first: strength into 0..cap, the factor (`consolidation.downscale_factor`) into 0..1
  - the result is clamped into min(strength, `consolidation.downscale_floor`)..strength: it never raises an edge, never drops one below the positive residual floor, and leaves an edge already at or below the floor as it is →=INV-1
  - Go `Downscale` and TS `downscale` are pinned by the golden fixture's downscale rows →!LINK-12
- LINK-15 [o] no dynamics deletes a synapse: every primitive changes the stored base only, and an edge dims toward silence but stays →=INV-1
  - a synapse leaves the graph only when an endpoint is sealed (the alive predicate) or by a user-originated hard delete →=MEM
  - emotion never enters connection: no valence, arousal or mood input to any synapse rule →=INV-3
- LINK-16 [o] synapse rows are inserted or changed at four sites only, and removed only by the user-originated hard deletes →=MEM
  | site | change | owner |
  |---|---|---|
  | launch link | insert at the same-memory initial, potentiate a repeat, add the temporal bonus | this domain |
  | recall | `Potentiate` once each synapse whose endpoints are both live member neurons of the recalled memory; count +1, last activation → the recall's universe time | →=RECALL-3 |
  | consolidation | `Downscale` of slept synapses, replay touch of `last_activated_universe_time` | →=CONSOL |
  | release, restore | `Depress` of contribution edges, then the exact reversal from the ledger | →=DEL-1 |

## chg
- r1 261102 initial

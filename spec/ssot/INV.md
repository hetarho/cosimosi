# INV invariants
> r1 | the constitution: the invariants every feature keeps and the misconceptions no feature may implement; breaking one means implementing wrong neuroscience

## decisions
- INV-1 [o] the system never deletes a memory: forgetting dims it to a floor, and only the user's own explicit deletion removes a diary, memory, neuron or synapse ← a forgotten trace persists but cannot be reached (silent engram), and the user keeps the right to delete
  - a shared neuron is never removed: deleting a memory only weakens that memory's contribution to the neuron's synapses →=DEL-1
  - hard deletion runs only in the user-originated sweeps: the release retention sweep after `release.soft_delete_retention_days` →=DEL-2 and the withdrawal purge after `account.withdrawal_retention_days` →=ACCT-10
  - sealed rows leave every dynamic but stay stored →=DEL-3; forgetting and downscaling never delete a row →~INV-9
  - job-queue maintenance deletes only `jobs` rows →=AI
  - guard: `pnpm lint:persistence` fails any product-table `DELETE` or `TRUNCATE` outside its hard-delete allowlist; the launch, recall and progression write ports expose no delete →=MEM
- INV-2 [o] the original `Diary` is never altered by reconsolidation, by the system or by the user: recall, forgetting and reconsolidation change only the representation (`CurrentText`, stage texts, shape seed) ← reconsolidation updates the memory, not the record
  - the original stays readable verbatim in the reader and the export →~DIARY-4
  - forgetting's word loss erodes the memory text, never the `Diary`; recall never writes it →~RECALL-7
  - exception: the user's explicit full delete hard-deletes the original once the restore window ends →~DEL-2
  - guard: no query updates `diaries`; the launch, recall and progression transaction ports expose no `Diary` write →=MEM
- INV-3 [o] emotion never sets position or linking: valence and arousal colour a memory, arousal alone also modulates size and forgetting speed, and neither ever reaches position or synapses ← emotion-driven placement collapses the universe into one cluster
  - valence is colour-only: never size, strength or forgetting →=MOOD-7
  - similar emotions are never placed together; proximity comes from shared neurons alone →!INV-4
  - guard: the layout graph (`buildUniverseGraph`, `packages/universe`) carries neuron connectivity and synapse strength only, no emotion field →=VIS; `Link` reads no mood →=LINK
- INV-4 [o] memories never connect or attract directly: proximity between memories emerges from shared neurons and their synapse strength ← an `EpisodicMemory` is an ensemble, so a direct memory↔memory edge misstates what links memories
  - a constellation is emergent: no type, no table, no stored size or count →=UL
  - nothing counts a cluster: the achievement axis is "memories sharing one neuron", never a connected-component size over synapses →=ACH-2
  - no line joins two stars; filaments join neurons only →=VIS-6
  - guard: synapses are the only edges of the layout graph, so a memory can never be an edge endpoint →=VIS
- INV-5 [o] position is emergent force-sim output, never stored: the server owns neurons, synapses and centrality only ← the brain has no absolute coordinate system
  - x,y emerge in the hippocampal layer; a gist version copies its episodic star's live position and rises only along z; the neocortex runs no force-sim and has no coordinate authority →~CONSOL-6 →~VIS-9
  - a new neuron's seed is a starting hint, never a stored coordinate →~ENC-7
  - guard: no table has a coordinate column; `GetUniverse` carries stored facts only; the encode output schema has no position field →=MEM →~WRITE-8
- INV-6 [o] a synapse exists only between two neurons →~LINK-6
  - guard: a `synapses` row references two `neurons` (both ends FK, `neuron_a_id < neuron_b_id`, one row per pair); no memory↔memory table exists →=MEM
- INV-7 [o] the centre is the self: radius means self-relevance (how connected a memory is), never time ← autobiographical memory is organized around the self
  - time is a link signal, never a position axis →=LINK-4 →=TIME-10
  - guard: the centre pull scales with server-owned neuron connectivity, and universe time has no path into layout →=VIS
- INV-8 [o] recall restores access, never the original content: it resets brightness and the decay stage, while reconstruction (text, seed) happens only in reconsolidation on a prediction error; a plain recall only reinforces ← remembering reconstructs rather than replays
  - recall resets the gist timer but never rewinds a gist stage already reached →=CONSOL-9
  - the recall rewrite surface never shows the original `Diary` →=RECALL
  - guard: `Reconsolidate` runs only behind the boolean `PredictionError.Differs` port →=RECALL-6
- INV-9 [o] associative weakening (LTD, `Depress`) and homeostatic sleep downscaling (SHY, `Downscale`) are distinct mechanisms, never conflated
  - associative and local: recall's competitor inhibition →~RECALL-5 and a deletion's contribution weakening (`Depress`) →=DEL-1
  - homeostatic and global: `Downscale` over every synapse, only in consolidation on a clock advance →~CONSOL-4
  - sleep pruning weakens synapses and never deletes a row →!INV-1
  - guard: `Downscale` and `Depress` are separate pure functions; only consolidation calls `Downscale` →=LINK
- INV-10 [o] time only moves forward: universe time advances only on a launch or a recall, and viewing alone stops it ← encoding cannot be undone
  - a diary dated before the clock is saved but launches no memory →=TIME-1
  - every archive read is viewing: it advances nothing →=DIARY-11
  - real time reaches the clock only as "today"; there is one clock →=TIME-5
  - guard: the clock's only write holds `max(current, target)`, and read ports carry no clock-advance method →=TIME-8 →=TIME-3
- INV-11 [o] customization never touches the meaning layer: the mood→colour mapping is personal, but "colour = emotion" and each memory's emotion, position and strength cannot be overwritten ← colour must honestly reflect emotion
  - ornaments and achievements alike: no purchase or achievement changes a memory's position, emotion, strength, forgetting or gist; money and achievement cannot buy meaning →=VIS-10 →=ACH-6
  - per-mood colour is a free preference, never an ornament →=DECOR-10 →=MOOD-6
  - guard: store rows hold ornament ids, an enum and timestamps only, so a colour, size, brightness or seed has nowhere to be written; bloom and camera are scene defaults, never for sale →=DECOR
  - guard: the achievement recorder port carries only `(scope, counterKey, delta)` →=ACH
- INV-12 [o] public copy is honest: it says the product is inspired by engram theory, never that it works like a brain, never presents the 3D coordinates as the brain's real coordinates, and never claims a therapeutic or efficacy effect ← the analogy is honest, coordinates are emergent visualization, letting go is not therapy
  - scope: public surfaces (landing, blog, demo, app-store listing) →=MKT
  - which claims about the brain are allowed →=SCI
  - guard: the landing copy-honesty test and `pnpm lint:public-copy` over the blog →=MKT
- INV-13 [o] the demo is a sandbox outside the invariants: it may move time freely, grant unlimited Twinkle and change any state, but its code path stays isolated from the real one and no demo bypass exists in real domain code ← unisolated, the demo's exemptions would breach the real invariants
  - a demo change is reviewed for isolation, not for invariant compliance →=DEMO-2
  - nothing made in the demo carries into an account →=DEMO-7
  - guard: the `src/pages/demo/**` import block (no transport, API client, server-backed mirror or price table), proven by `pnpm lint:demo:probe`; no `isDemo` flag, prop or branch in `packages/*`, `features/*` or `entities/*` →=DEMO
- INV-14 [o] a memory is an ensemble, never a fragment or a single cell: an `EpisodicMemory` is a sparse bundle of shared `Neuron`s, and no single neuron carries one piece of information ← an engram binds distributed neurons together; it is not a memory broken into pieces
  - the two layers (neuron, memory) are mandatory →=MEM
- INV-15 [o] a diary splits at event boundaries (a change of place, person, activity or topic), never at a change of emotion →=ENC-1
- INV-16 [o] semantic-embedding similarity never links memories: constellations grow only by neuron reuse, and embeddings only assist neuron canonicalization →=LINK-3 →=ENC-10 ← similarity links collapse the constellations into one mass
- INV-17 [o] forgetting never moves a star: it is dimming plus word loss, never a drift away from the centre →=FORGET-1 ← the brain has no "distance = forgetting" axis; forgetting is a change of access
- INV-18 [o] forgetting and semanticization are independent axes: loss of access (brightness, word loss) and gist compression (rise along z) are never modelled as one process →=FORGET →=CONSOL

## constraints
- every feature is checked against INV-1–18 before it is planned; a feature that cannot keep one is resolved in the owning SSOT first
- an invariant at risk is guarded by structure (a type shape, a port surface, a DB constraint, a lint), never by a review habit; the guard's details live with its owner
- AI output cannot carry an invariant-violating value: the encode output schema has no position, colour, strength, seed, time or delete field, and AI ports only propose →=WRITE-8 →=AI

## chg
- r1 261102 initial

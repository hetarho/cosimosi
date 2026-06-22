// Package memory is the diary/star feature core: pure domain types plus the
// consumer-side interfaces its service depends on. It holds NO transport (proto)
// or persistence (sqlc/db) tags — those live in the handler and repository_pg
// adapters (constitution §5: domain is pure).
package memory

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/cosimosi/backend/internal/values"
)

// Validation sentinels for the write path. records are append-only (constitution
// §1), so rejecting invalid input BEFORE the transaction is the only defense —
// there is no cleanup path afterwards. The handler maps these to InvalidArgument.
// ⚠️ The FE substring-matches these MESSAGE TEXTS to pick Korean copy
// (frontend/src/features/record-memory/api/record-memory.ts) — rewording one
// breaks that mapping silently; service_test.go pins the matched substrings.
var (
	ErrEmptyBody       = errors.New("memory: body is empty")
	ErrBodyTooLong     = errors.New("memory: body exceeds max length")
	ErrIntensityRange  = errors.New("memory: intensity out of range [0,1]")
	ErrValenceRange    = errors.New("memory: valence out of range [-1,1]")
	ErrEmptySegment    = errors.New("memory: segment text is empty")
	ErrSegmentTooLong  = errors.New("memory: segment text exceeds max length")
	ErrTooManySegments = errors.New("memory: too many segments")
)

// MaxBodyRunes caps the diary body length. It MIRRORS (must stay in sync with)
// the embedder input cap ai/openai.go maxInputRunes: anything longer would be
// silently truncated before embedding, so the star's semantic position would
// ignore the tail — better to reject up front than embed half a diary. The FE
// error copy ("4000자") also assumes this value.
const MaxBodyRunes = 4000

// Mood is the domain mood, one of 13 fixed values (4 affective quadrants ×3 + neutral;
// spec 29) or empty = unspecified. It is stored as its lowercase string in records.mood
// (nullable) and mapped to/from the proto Mood enum in the handler. The empty Mood means
// "not set". Values are string-aligned 1:1 with proto Mood and the FE MOOD_PALETTE keys.
type Mood string

const (
	MoodUnspecified Mood = ""
	MoodJoy         Mood = "joy"
	MoodCalm        Mood = "calm"
	MoodSad         Mood = "sad"
	MoodAnger       Mood = "anger"
	MoodFear        Mood = "fear"
	MoodLove        Mood = "love"
	MoodNeutral     Mood = "neutral"
	MoodExcitement  Mood = "excitement"
	MoodGratitude   Mood = "gratitude"
	MoodRelief      Mood = "relief"
	MoodStress      Mood = "stress"
	MoodTired       Mood = "tired"
	MoodEmptiness   Mood = "emptiness"
)

// MaxSegments caps a user-confirmed fragment list. The AI proposes at most 5
// (ai maxSegments); the review step lets the user add manual fragments on top,
// so this cap is higher but still bounded (each fragment costs an embed job).
const MaxSegments = 10

// SegmentInput is one fragment star of a diary: the AI's proposal from
// SegmentMemory (preview) and, after the user reviewed/edited it, the confirmed
// shape persisted by RecordMemory. Unlike the record-level hints, mood/
// intensity/valence here are the fragment's OWN values, not fallbacks.
type SegmentInput struct {
	Text      string
	Mood      Mood
	Intensity float64 // 0..1
	Valence   float64 // -1..1
}

// RecordInput is what RecordMemory writes to the immutable records table
// (constitution §1). It is deliberately separate from the Memory (star) domain:
// the original diary text is persisted here and never mutated. Mood/Intensity/
// Valence are OPTIONAL whole-diary hints (spec 21) — the AI detects per-fragment
// emotion; a hint only feeds the degraded-extraction fallback.
type RecordInput struct {
	UserID         string
	Body           string    // the diary original — kept forever in records
	EntryDate      time.Time // user-chosen moment (defaults to today)
	Mood           Mood      // optional hint (MoodUnspecified → stored NULL)
	Intensity      float64   // 0..1, optional hint (0 when unset)
	Valence        float64   // -1..1, optional hint (0 when unset)
	IdempotencyKey string    // optional; empty = not applied
	// Segments is the user-confirmed fragment list from the review step. When
	// non-empty the repository persists EXACTLY these as the fragment stars in
	// the record's transaction (no async extract job); empty keeps the legacy
	// async-extract path.
	Segments []SegmentInput
}

// Memory is the star projection used by GetUniverse — no body, no entry_date.
// mood/intensity/valence are the FRAGMENT's own (memories, spec 21);
// brightness/coordinates are NOT here (computed client-side, constitution §2·§3).
// The reshaping state (spec 23) IS here — it is a render input to the mutable star
// layer, not a coordinate.
type Memory struct {
	ID             string // = memory_id
	Mood           Mood   // the fragment's AI-detected mood
	Intensity      float64
	Valence        float64    // -1..1 signed affect (26 consumes in λ_eff)
	LastRecalledAt *time.Time // activity basis for client brightness (04 never mutates it)
	// Wayfinding (spec 28): which immutable original diary this star is a fragment of,
	// and its order within it. The client GROUPS stars by RecordID for whole-diary
	// framing/highlighting (원본 일기로 별 찾기). Empty/zero outside ListByUser (ListDormant
	// doesn't read them — dormant search is per-star).
	RecordID      string
	FragmentIndex int
	// Reconsolidation reshaping (spec 23): cumulative ± brightness offset, hue shift
	// (degrees), form-seed jitter, and the version (= variant-log length).
	BrightnessOffset float64
	HueShift         float64
	FormSeedDelta    float64
	Version          int
	// Relevance (spec 26): 0..1 cosine alignment of the star's embedding with the "요즘
	// 토픽" centroid, computed in GetUniverse (0 elsewhere — ListDormant doesn't score it).
	// A λ_eff input the client folds into modulated decay; NOT a coordinate. Like weight it
	// is a server-derived semantic-graph quantity, so sending it doesn't break constitution
	// §3 (brightness itself stays a client render computation).
	Relevance float64
	// Resonant (spec 36): true when this star is linked to a star in ANOTHER universe by a
	// resonance (a gift this user sent and a friend accepted, or a star born from accepting a
	// friend's gift). GetUniverse joins resonances to fill it; ListDormant leaves it false
	// (dormant search is per-star, no resonance join). The client draws a faint resonance marker.
	Resonant bool
	// RecallCount (spec 07): cumulative recall count — server-authoritative raw datum
	// (RecallMemoryTouch bumps it). The client derives Bjork storage strength S and retrieval
	// strength R from it to drive self-proximity radius (38) + the background emotion ranking.
	// Existing stars backfill to 1 (migration default). Not a coordinate — like Relevance it is
	// a server-derived datum the client folds into a render computation (constitution §3 intact).
	RecallCount int
}

// EvolutionSnapshot is one append-only reshaping event of a star (spec 23): the
// cumulative reshaping state at that version plus what triggered it. Read by spec
// 24 (timelapse UI). Pure domain — no db/proto tags (constitution §5).
type EvolutionSnapshot struct {
	Version       int
	Brightness    float64 // brightness_offset snapshot at this version
	HueShift      float64
	FormSeedDelta float64
	Trigger       string // 'recall' | 'new_neighbor' | 'nightly_gist'
	PE            float64
	Dir           int // +1 강화 / -1 약화
	CreatedAt     time.Time
}

// ReshapeState is the cumulative reshaping state of one star, the input/output of a
// single reconsolidation step (spec 23). Brightness offset, hue shift (degrees) and
// form-seed delta accumulate within their bounds; version counts the variants.
type ReshapeState struct {
	BrightnessOffset float64
	HueShift         float64
	FormSeedDelta    float64
	Version          int
}

// ReshapeContext is the PE/strength input the service reads before a reconsolidation
// step (spec 23): the current reshaping state, the two embeddings whose angle is the
// prediction error, the co-recall total (strength = how consolidated the star is) and
// its age. Pure domain.
//
// PE = clamp(1 - cos(RecallEmbedding, ConsolidatedEmbedding), 0, 1). The repository
// derives RecallEmbedding from the co-recalled neighbor context and uses the star's
// own embedding as the consolidated baseline; isolated/no-context stars fall back to
// equal embeddings and stay a plain re-ignition.
type ReshapeContext struct {
	State                 ReshapeState
	RecallEmbedding       []float64 // recall_ctx_emb
	ConsolidatedEmbedding []float64 // last_consolidated_emb baseline
	CoRecall              int       // Σ co_activation_count over incident links → strength
	CreatedAt             time.Time
}

// Synapse is a weighted, undirected (a < b) link between two stars. Only weight
// is authoritative; thickness/brightness are derived in the client shader. This
// type lives in the memory package (not link) so the link reader can return it
// without the memory service importing link (avoids an import cycle).
type Synapse struct {
	AID, BID          string
	Weight            float64
	LinkType          string
	CoActivationCount int
	LastActivatedAt   *time.Time
}

// (spec 07) AmbientMood / EmotionSample / AggregateAmbient were retired: the server no
// longer summarizes "요즘" emotion. The client derives the emotion ranking + arousal from
// the loaded stars (+recall_count) via the Bjork retrieval strength R itself.

// StarVector is one star's semantic embedding plus the recency/intensity weights
// that build the "요즘 토픽" centroid (spec 26). Embedding is empty when the embed job
// hasn't run yet (→ that star scores relevance 0). Pure domain — the repository maps
// the sqlc row into this.
type StarVector struct {
	ID             string
	Embedding      []float64
	Intensity      float64
	LastRecalledAt time.Time
}

// Universe is the whole authoritative graph for one user: every star and every
// synapse, dormant ones included (no brightness filter — constitution §2). spec 07: the
// server no longer carries an ambient summary — the client derives the "요즘" emotion
// ranking + arousal from the loaded stars (+recall_count) via the Bjork strength R.
type Universe struct {
	Memories []Memory
	Synapses []Synapse
}

const (
	// TauMoodDays is the slow "요즘 토픽" envelope (spec 26 RelevanceByStar centroid weight):
	// far slower than the 6h excitability window (22's tauExc) — relevance reads over days.
	// (spec 07 retired the ambient-mood aggregation that also used it; relevance keeps it.)
	TauMoodDays = values.AmbientTauMoodDays
	// arousalGainCoef: g = 1 + 0.3·arousal (arousal∈[0,1] → gain∈[1,1.3]).
	arousalGainCoef = values.AmbientArousalGain
)

// ExcitabilityGain is the global gain "요즘" arousal exposes to the competitive allocation
// bias (spec 22/25, concept §결정2): a more aroused "요즘" pulls new fragments harder
// toward hot clusters (W_EXC ← W_EXC·g). spec 07 retired the server ambient summary, so the
// worker derives arousal from the same star recall data the client uses for Bjork R.
// arousal∈[0,1] → gain 1.0 at rest.
func ExcitabilityGain(arousal float64) float64 { return 1 + arousalGainCoef*arousal }

// ArousalSample is one star's raw Bjork R input. It is intentionally small and
// transport/storage-agnostic so the worker can derive the user-level "요즘" arousal
// without reintroducing a server ambient summary.
type ArousalSample struct {
	RecallCount    int
	Intensity      float64
	LastRecalledAt time.Time
}

// ArousalFromSamples mirrors the client ambient.arousalOf formula: arousal =
// 1-exp(-ΣR), where R is Bjork retrieval strength from recall_count, intensity,
// and last_recalled_at. Empty universes settle at rest (0).
func ArousalFromSamples(samples []ArousalSample, now time.Time) float64 {
	var sum float64
	for _, s := range samples {
		sum += retrievalStrength(storageStrength(s.RecallCount, s.Intensity), now.Sub(s.LastRecalledAt).Hours()/24)
	}
	return 1 - math.Exp(-sum)
}

func storageStrength(recallCount int, intensity float64) float64 {
	n := math.Max(0, float64(recallCount))
	return (values.MemoryWeightStorageBase + n) * (1 + values.MemoryWeightEmoConsolidation*clampf(intensity, 0, 1))
}

func retrievalStrength(storage, dtDays float64) float64 {
	tau := values.MemoryWeightTau0Days * (1 + values.MemoryWeightTauStorageGain*math.Log1p(math.Max(0, storage)))
	return math.Exp(-math.Max(0, dtDays) / tau)
}

// RelevanceByStar scores each star's alignment with the user's "요즘 토픽" (spec 26):
// it folds the star embeddings into a time-weighted centroid using the same per-fragment
// intensity·exp(-Δt/τ) weight AggregateAmbient uses (decay makes old stars negligible, so
// "요즘" agrees with the mood color — though this scores over ALL stars, not just a window),
// then relevance = clamp(cos(star_emb, centroid), 0, 1) per star. The centroid INCLUDES the
// star being scored (a recent/intense star reads as on-topic — it IS the topic; that's fine,
// since it is already bright and the term mainly governs older stars, which weigh negligibly
// in the centroid — leave-one-out is a possible spec-27 refinement). A star whose embed job
// hasn't run (empty embedding) scores 0; an empty universe or zero-norm centroid yields all-0,
// so the client's R_recent folds to the no-op 1.0. Cosine is scale-invariant, so the centroid
// is left un-normalized. now is injected (testable).
func RelevanceByStar(vectors []StarVector, now time.Time) map[string]float64 {
	out := make(map[string]float64, len(vectors))
	if len(vectors) == 0 {
		return out
	}
	var centroid []float64
	var sumW float64
	for _, v := range vectors {
		if len(v.Embedding) == 0 {
			continue
		}
		if centroid == nil {
			centroid = make([]float64, len(v.Embedding))
		} else if len(v.Embedding) != len(centroid) {
			continue // defensive: skip a stray mismatched dimension
		}
		dtDays := now.Sub(v.LastRecalledAt).Hours() / 24
		if dtDays < 0 {
			dtDays = 0 // future timestamp (clock skew) → treat as now
		}
		intensity := v.Intensity
		if intensity < 0 {
			intensity = 0
		}
		w := intensity * math.Exp(-dtDays/TauMoodDays)
		if w <= 0 {
			continue
		}
		for i, x := range v.Embedding {
			centroid[i] += w * x
		}
		sumW += w
	}
	if sumW <= 0 || centroid == nil {
		return out // nothing to compare against → every star neutral (relevance 0)
	}
	for _, v := range vectors {
		if len(v.Embedding) != len(centroid) {
			continue // embeddingless / mismatched stars stay relevance 0
		}
		out[v.ID] = clampf(cosineSim(v.Embedding, centroid), 0, 1)
	}
	return out
}

// LinkDelta is one co-recall reinforcement increment for a star pair.
type LinkDelta struct {
	AID, BID    string
	DeltaWeight float64
}

// Record is the immutable original diary, read on recall (constitution §1). Sourced
// from the records table (not memories — the star carries no body). FragmentText is
// the recalled STAR's own fragment slice (memories.fragment_text, spec 28) — empty for
// single-fragment / pre-21 stars; Body always stays the WHOLE original (원본 일기 전체).
type Record struct {
	Body         string
	EntryDate    time.Time
	Mood         Mood
	Intensity    float64
	CreatedAt    time.Time
	FragmentText string
}

// RecordSummary is one original diary as a wayfinding entry point (spec 28): id (the
// Star.RecordID group key), entry date, a short body excerpt (never the full body) and
// how many fragment stars it spawned. Pure domain — no db/proto tags (constitution §5).
type RecordSummary struct {
	RecordID    string
	EntryDate   time.Time
	BodyExcerpt string
	StarCount   int
	// Moods is the de-duplicated set of moods across this diary's fragment stars
	// (change 09) — the emotion facet the journal list filters on client-side
	// without a server round-trip. Empty when no fragment carries a mood.
	Moods []Mood
}

// LinkService is the consumer-defined synapse port the memory service needs: read
// (compose a Universe) + co-recall reinforcement (spec 11). link.Service satisfies
// it. Defining it here (not importing link) keeps the dependency one-way:
// link → memory, never the reverse.
type LinkService interface {
	ListByUser(ctx context.Context, userID string) ([]Synapse, error)
	ReinforceLinks(ctx context.Context, userID, batchID string, deltas []LinkDelta) error
}

// Extractor is the consumer-defined segmentation port for the synchronous
// SegmentMemory preview (the review step): split a diary into proposed
// fragments. Satisfied by a composition-root adapter over ai.Extractor —
// memory must NOT import ai (the ai test suite imports memory for the body-cap
// mirror guard, so an ai import here would be an import cycle).
type Extractor interface {
	Extract(ctx context.Context, body string) ([]SegmentInput, error)
}

package memory

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// ErrLaunchInvalidMemories is the canonical invalid-input error for LaunchStars:
// the confirmed split must still honor the encode invariants — the preview is not
// the only gate, a hand-crafted request cannot bypass the policy (§2.9#7).
var ErrLaunchInvalidMemories = errors.New("memory launch requires a valid confirmed split")

// LaunchResult is PersistEncoded's optimistic return (§2.8): ids only —
// embeddings and gist texts fill on the next read. NewNeuronIDs are the neurons
// genuinely created (not deduped onto existing ones) — newness is a server-only
// decision, surfaced for the awaken animation ([E7a]).
type LaunchResult struct {
	DiaryID      string
	MemoryIDs    []string
	NewNeuronIDs []string
	// PastDated reports the monotonic launch guard [I10][T1]: the diary was saved
	// but no EpisodicMemory launched, because diary_date precedes the universe
	// clock.
	PastDated bool
	// The clock before/after this launch's advance — the interval the
	// acceleration animation plays over ([T2]). Nil Previous = the first-ever
	// launch; a past-dated launch carries the unmoved clock in both.
	PreviousUniverseTime *time.Time
	UniverseTime         *time.Time
}

// PersistEncoded atomically commits the user-confirmed split at launch: Diary +
// EpisodicMemory + Neuron (deduped) + NeuronActivation in one transaction, then
// the Link seam and the async embed/semanticize enqueue. Invoked by LaunchStars.
func (s *Service) PersistEncoded(ctx context.Context, scope platform.UserScope, body string, diaryDate time.Time, confirmed []ExtractedMemory) (LaunchResult, error) {
	if scope.UserID() == "" {
		return LaunchResult{}, ErrScopeRequired
	}
	body = strings.TrimSpace(body)
	if body == "" || diaryDate.IsZero() {
		return LaunchResult{}, ErrEncodeInputRequired
	}
	// A diary records a lived day: a future-dated launch would advance the
	// monotonic universe clock past real time and permanently past-date every
	// later diary [I10], so it is rejected. One day of slack covers the maximum
	// UTC offset (UTC+14) between the user's local date and the server's.
	if latestAllowed := utcDate(s.now()).AddDate(0, 0, 1); diaryDate.After(latestAllowed) {
		return LaunchResult{}, fmt.Errorf("%w: diary date %s is in the future",
			ErrEncodeInputRequired, diaryDate.Format(time.DateOnly))
	}
	if err := validateConfirmedSplit(confirmed); err != nil {
		return LaunchResult{}, err
	}

	var result LaunchResult
	err := s.launches.InLaunchTx(ctx, func(tx LaunchTx) error {
		// Serialize this user's launches for the whole transaction before the
		// guard read. The advisory lock covers the birth window a locked clock
		// read cannot — an unborn clock has no row to FOR UPDATE, so without it
		// two concurrent first-launches would both pass the guard against a
		// stale nil clock and one could launch a memory that should have been
		// past-dated ([I10][T1]).
		if err := tx.LockUniverseClock(ctx, scope); err != nil {
			return err
		}
		// With the birth window serialized, the guard read reflects any
		// concurrent launch that already committed: FOR UPDATE holds the row
		// once it exists, and LockUniverseClock covers the pre-row window.
		clock, err := tx.UniverseClockForUpdate(ctx, scope)
		if err != nil {
			return err
		}
		// While the clock row is unborn (a universe launched before the clock
		// existed), guard against the newest launched memory instead — the
		// same fallback the universe read uses — so the clock can never be
		// born at a date before the universe's present.
		guard := clock
		if guard == nil {
			guard, err = tx.LatestLaunchedUniverseTime(ctx, scope)
			if err != nil {
				return err
			}
		}
		diary, err := tx.InsertDiary(ctx, scope, Diary{
			ID:        s.newID(),
			Body:      body,
			DiaryDate: diaryDate,
			CreatedAt: s.now(),
		})
		if err != nil {
			return err
		}
		result.DiaryID = diary.ID
		result.PreviousUniverseTime = guard
		result.UniverseTime = guard
		// Monotonic launch guard [I10][T1]: a past-dated diary is saved (the
		// objective record always lands) but launches no EpisodicMemory, and
		// the clock stays unmoved — the response interval is {clock, clock}.
		if !CanLaunchAt(diaryDate, guard) {
			result.PastDated = true
			return nil
		}

		neuronIDByKey, newNeurons, err := s.resolveNeurons(ctx, scope, tx, confirmed)
		if err != nil {
			return err
		}
		for _, neuron := range newNeurons {
			result.NewNeuronIDs = append(result.NewNeuronIDs, neuron.ID)
		}

		launched := make([]LaunchedMemory, 0, len(confirmed))
		for _, confirmedMemory := range confirmed {
			emotion, ok := NewEmotion(confirmedMemory.Mood)
			if !ok {
				return fmt.Errorf("%w: mood %q", ErrLaunchInvalidMemories, confirmedMemory.Mood)
			}
			seed := s.newSeed()
			episodicMemory, err := tx.InsertEpisodicMemory(ctx, scope, EpisodicMemory{
				ID:      s.newID(),
				DiaryID: diary.ID,
				Name:    strings.TrimSpace(confirmedMemory.Name),
				// The initial "current memory text" is the original account —
				// recall/reconsolidation rewrites it later, never the Diary ([R8a][I2]).
				CurrentText:         body,
				Seed:                &seed,
				Emotion:             emotion,
				BaseStrength:        ArousalToInitialStrength(emotion.Arousal),
				CreatedUniverseTime: diaryDate,
			})
			if err != nil {
				return err
			}
			result.MemoryIDs = append(result.MemoryIDs, episodicMemory.ID)

			neuronIDs := make([]string, 0, len(confirmedMemory.Neurons))
			activated := make(map[string]struct{}, len(confirmedMemory.Neurons))
			for _, neuron := range confirmedMemory.Neurons {
				neuronID := neuronIDByKey[neuronKey(neuron.Name, neuron.Type)]
				if _, ok := activated[neuronID]; ok {
					continue
				}
				activated[neuronID] = struct{}{}
				// The schema-forced extractor output carries no weight by [W4a]
				// design and the column is NOT NULL, so the launch writes the
				// tuned uniform weight ([E8] differentiation is a later epic).
				if _, err := tx.InsertNeuronActivation(ctx, scope, NeuronActivation{
					EpisodicMemoryID: episodicMemory.ID,
					NeuronID:         neuronID,
					Weight:           float32(values.EncodeActivationWeight),
				}); err != nil {
					return err
				}
				neuronIDs = append(neuronIDs, neuronID)
			}
			launched = append(launched, LaunchedMemory{EpisodicMemory: episodicMemory, NeuronIDs: neuronIDs})
		}

		// Link runs before the async enqueue: synapses land atomically
		// with the launch.
		if err := s.linker.LinkLaunched(ctx, scope, tx, launched); err != nil {
			return err
		}
		if err := s.enqueueAsyncJobs(ctx, scope, tx, body, confirmed, launched, newNeurons); err != nil {
			return err
		}

		// The advance is the transaction's last step ([T2] case 1): the domain
		// computes the target (AdvanceClock; the upsert's GREATEST is the SQL
		// mirror), the clock moves to the diary date, and the progression hook
		// sees the crossed interval — all atomic with the launch rows.
		return s.advanceAndProgress(ctx, scope, tx, guard, AdvanceClock(timeOrZero(guard), diaryDate), &result.UniverseTime)
	})
	if err != nil {
		return LaunchResult{}, err
	}
	return result, nil
}

// Universe returns the stored universe facts plus the universe time from the
// authoritative universe_state clock ([T5]). One-release fallback: a universe
// whose clock row has not been born yet (launched before the clock existed)
// still reads the latest launched memory's created_universe_time from the same
// snapshot, so no universe visibly resets; an empty universe reads nil.
// Reading never advances the clock ([T3]).
func (s *Service) Universe(ctx context.Context, scope platform.UserScope) (UniverseFacts, *time.Time, error) {
	if scope.UserID() == "" {
		return UniverseFacts{}, nil, ErrScopeRequired
	}
	facts, err := s.universe.GetUniverse(ctx, scope)
	if err != nil {
		return UniverseFacts{}, nil, err
	}
	universeTime := facts.UniverseClock
	if universeTime == nil {
		for _, episodicMemory := range facts.EpisodicMemories {
			created := episodicMemory.CreatedUniverseTime
			if universeTime == nil || created.After(*universeTime) {
				universeTime = &created
			}
		}
	}
	return facts, universeTime, nil
}

// resolveNeurons honors the extractor's dedup at persist time ([E10]): a proposed
// neuron whose (name, type) canonicalized onto an existing neuron references that
// id; a genuinely new (name, type) is created once and shared across this
// launch's memories. Neurons are never deleted [I1].
func (s *Service) resolveNeurons(ctx context.Context, scope platform.UserScope, tx LaunchTx, confirmed []ExtractedMemory) (map[string]string, []Neuron, error) {
	keys := make([]string, 0)
	names := make([]string, 0)
	byKey := make(map[string]ExtractedNeuron)
	for _, confirmedMemory := range confirmed {
		for _, neuron := range confirmedMemory.Neurons {
			key := neuronKey(neuron.Name, neuron.Type)
			if _, ok := byKey[key]; ok {
				continue
			}
			byKey[key] = neuron
			keys = append(keys, key)
			names = append(names, strings.ToLower(strings.TrimSpace(neuron.Name)))
		}
	}

	existing, err := tx.FindNeuronsByNames(ctx, scope, names)
	if err != nil {
		return nil, nil, err
	}
	idByKey := make(map[string]string, len(keys))
	for _, neuron := range existing {
		idByKey[neuronKey(neuron.Name, neuron.Type)] = neuron.ID
	}

	newNeurons := make([]Neuron, 0)
	for _, key := range keys {
		if _, ok := idByKey[key]; ok {
			continue
		}
		proposed := byKey[key]
		name := strings.TrimSpace(proposed.Name)
		created, err := tx.UpsertNeuron(ctx, scope, Neuron{
			ID:        s.newID(),
			Name:      &name,
			Type:      proposed.Type,
			CreatedAt: s.now(),
		})
		if err != nil {
			return nil, nil, err
		}
		idByKey[key] = created.ID
		newNeurons = append(newNeurons, created)
	}
	return idByKey, newNeurons, nil
}

// enqueueAsyncJobs hands the slow work to the worker (§2.8): one embed job for
// the genuinely new neurons and one semanticize job per launched memory.
func (s *Service) enqueueAsyncJobs(ctx context.Context, scope platform.UserScope, tx LaunchTx, body string, confirmed []ExtractedMemory, launched []LaunchedMemory, newNeurons []Neuron) error {
	if len(newNeurons) > 0 {
		payload := EmbedJobPayload{Neurons: make([]EmbedJobNeuron, 0, len(newNeurons))}
		for _, neuron := range newNeurons {
			name := ""
			if neuron.Name != nil {
				name = *neuron.Name
			}
			payload.Neurons = append(payload.Neurons, EmbedJobNeuron{ID: neuron.ID, Text: name})
		}
		if err := s.enqueue(ctx, scope, tx, JobKindEmbed, payload); err != nil {
			return err
		}
	}
	// launched is built 1:1 in confirmed order, so index i pairs the persisted
	// memory with the confirmed neurons the semanticizer should see.
	for i, launchedMemory := range launched {
		neurons := make([]SemanticJobNeuron, 0, len(confirmed[i].Neurons))
		for _, neuron := range confirmed[i].Neurons {
			neurons = append(neurons, SemanticJobNeuron{Name: neuron.Name, Type: neuron.Type})
		}
		payload := SemanticizeJobPayload{
			MemoryID:    launchedMemory.ID,
			Name:        launchedMemory.Name,
			CurrentText: body,
			Mood:        launchedMemory.Emotion.Mood,
			Neurons:     neurons,
		}
		if err := s.enqueue(ctx, scope, tx, JobKindSemanticize, payload); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) enqueue(ctx context.Context, scope platform.UserScope, tx ProgressionTx, kind JobKind, payload any) error {
	return enqueueJob(ctx, tx, scope, s.newID(), s.now(), kind, payload)
}

// validateConfirmedSplit re-applies the encode invariants to the user-confirmed
// memories: count within [encode.min_memories, encode.max_memories] [E2], every
// memory ≥ encode.min_semantic_neurons semantic neurons [E4], valid mood/type
// [M1][E3]. Violations are invalid input here — there is no LLM to repair.
func validateConfirmedSplit(confirmed []ExtractedMemory) error {
	if !memoryCountInRange(len(confirmed)) {
		return fmt.Errorf("%w: %d memories outside [%d, %d]",
			ErrLaunchInvalidMemories, len(confirmed), values.EncodeMinMemories, values.EncodeMaxMemories)
	}
	if err := validateSplitStructure(ExtractResult{Memories: confirmed}); err != nil {
		return fmt.Errorf("%w: %v", ErrLaunchInvalidMemories, err)
	}
	for _, confirmedMemory := range confirmed {
		if !hasRequiredSemanticNeurons(confirmedMemory) {
			return fmt.Errorf("%w: memory %q carries too few semantic neurons",
				ErrLaunchInvalidMemories, confirmedMemory.Name)
		}
	}
	return nil
}

func neuronKey(name string, neuronType NeuronType) string {
	return strings.ToLower(strings.TrimSpace(name)) + "\x00" + string(neuronType)
}

func utcDate(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

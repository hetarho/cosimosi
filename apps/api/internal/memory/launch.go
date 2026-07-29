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
	// A future-dated launch would advance the monotonic universe clock past real time and
	// permanently past-date later diaries [I10], so the user's profile zone defines today.
	today, err := s.userToday(ctx, scope)
	if err != nil {
		return LaunchResult{}, err
	}
	if diaryDate.After(today) {
		return LaunchResult{}, fmt.Errorf("%w: diary date %s is in the future",
			ErrEncodeInputRequired, diaryDate.Format(time.DateOnly))
	}
	if err := validateConfirmedSplit(body, confirmed); err != nil {
		return LaunchResult{}, err
	}

	var result LaunchResult
	err = s.launches.InLaunchTx(ctx, func(tx LaunchTx) error {
		// Serialize this user's launches for the whole transaction before the
		// guard read. The advisory lock covers the birth window a locked clock
		// read cannot — an unborn clock has no row to FOR UPDATE, so without it
		// two concurrent first-launches would both pass the guard against a
		// stale nil clock and one could launch a memory that should have been
		// past-dated ([I10][T1]).
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		// With the birth window serialized, the guard read reflects any
		// concurrent launch that already committed: FOR UPDATE holds the row
		// once it exists, and LockGraphMutation covers the pre-row window.
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
		// Earn-on-write ([G3]): one grant per launched diary — not per memory — fired
		// inside this transaction so the launch and its grant commit or roll back
		// together. Placed after the monotonic guard's early return, so a past-dated
		// diary that launches no episodic memory earns nothing ([I10]).
		if err := s.earn.OnDiaryLaunched(ctx, scope, tx, diary.ID); err != nil {
			return err
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
				// One EpisodicMemory, one scene: it is born holding its own passage of
				// the diary, in the writer's words. The same value lands twice on purpose —
				// current_text is the living representation that recall/reconsolidation
				// rewrites, source_text is the birth record that must still read true
				// afterwards, which is what 변천사의 created/original entry shows
				// ([R8a][I2]).
				SourceText:          strings.TrimSpace(confirmedMemory.SourceText),
				CurrentText:         strings.TrimSpace(confirmedMemory.SourceText),
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
		// The counter facts, reported after the activations are persisted so the sharing depth is
		// read from the graph this launch just made ([A6]). Same transaction, so a rollback here
		// leaves no counter advanced.
		if err := s.recordLaunchProgress(ctx, scope, tx, diary.ID, launched); err != nil {
			return err
		}
		if err := s.enqueueAsyncJobs(ctx, scope, tx, launched, newNeurons); err != nil {
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
	if !result.PastDated {
		// Deferred signup settlement is intentionally after the launch transaction commits.
		// It carries only the authenticated scope, cannot inspect the launched meaning, and
		// cannot fail the committed launch.
		s.signupSettlement.OnEngramsLaunched(ctx, scope)
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
func (s *Service) enqueueAsyncJobs(ctx context.Context, scope platform.UserScope, tx LaunchTx, launched []LaunchedMemory, newNeurons []Neuron) error {
	if len(newNeurons) > 0 {
		targets := make([]JobTarget, 0, len(newNeurons))
		for _, neuron := range newNeurons {
			targets = append(targets, JobTarget{Kind: JobTargetNeuron, ID: neuron.ID, ExpectedRevision: neuron.RepresentationRevision})
		}
		if err := s.enqueue(ctx, scope, tx, JobKindEmbed, EmbedJobPayload{}, targets...); err != nil {
			return err
		}
	}
	for _, launchedMemory := range launched {
		if err := s.enqueue(ctx, scope, tx, JobKindSemanticize, SemanticizeJobPayload{}, JobTarget{
			Kind: JobTargetMemory, ID: launchedMemory.ID, ExpectedRevision: launchedMemory.RepresentationRevision,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) enqueue(ctx context.Context, scope platform.UserScope, tx ProgressionTx, kind JobKind, payload any, targets ...JobTarget) error {
	return enqueueJob(ctx, tx, scope, s.newID(), s.now(), kind, payload, targets...)
}

// validateConfirmedSplit re-applies the encode invariants to the user-confirmed
// memories: count within [encode.min_memories, encode.max_memories] [E2], every
// memory ≥ encode.min_semantic_neurons semantic neurons [E4], valid mood/type
// [M1][E3]. Violations are invalid input here — there is no LLM to repair.
func validateConfirmedSplit(body string, confirmed []ExtractedMemory) error {
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
		// A passage is bounded by the diary it came from, but its WORDS are not checked
		// here: by launch time it may be the writer's own edit, and the writer cannot be
		// wrong about their own account ([W4]). The fidelity rule guards the extractor
		// (sourcetext.go), and it already ran in the preview.
		if len([]rune(confirmedMemory.SourceText)) > len([]rune(body)) {
			return fmt.Errorf("%w: memory %q carries a source text longer than the diary",
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

func dateInLocation(value time.Time, location *time.Location) time.Time {
	if location == nil {
		location = time.UTC
	}
	local := value.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

func (s *Service) userToday(ctx context.Context, scope platform.UserScope) (time.Time, error) {
	location, err := s.userZone.ZoneFor(ctx, scope)
	if err != nil {
		return time.Time{}, err
	}
	return dateInLocation(s.now(), location), nil
}

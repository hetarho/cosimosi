package memory

import (
	"context"
	"encoding/json"
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
// decision, surfaced for the awaken animation ([E7a], plan 25).
type LaunchResult struct {
	DiaryID      string
	MemoryIDs    []string
	NewNeuronIDs []string
	// PastDated reports the monotonic launch guard [I10][T1]: the diary was saved
	// but no EpisodicMemory launched, because diary_date precedes the latest
	// launched one.
	PastDated bool
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
		latest, err := tx.LatestLaunchedUniverseTime(ctx, scope)
		if err != nil {
			return err
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
		// Monotonic launch guard [I10][T1]: a past-dated diary is saved (the
		// objective record always lands) but launches no EpisodicMemory.
		// Universe-clock advance itself is Epic B; this guard is Epic A's seam.
		if latest != nil && diaryDate.Before(*latest) {
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

		// Link seam (plan 21): the last in-transaction step. Job 27 wires the
		// real Link here; until then the seam is nil and no synapse is created.
		if s.linker != nil {
			if err := s.linker.LinkLaunched(ctx, scope, tx, launched); err != nil {
				return err
			}
		}

		return s.enqueueAsyncJobs(ctx, scope, tx, body, confirmed, launched, newNeurons)
	})
	if err != nil {
		return LaunchResult{}, err
	}
	return result, nil
}

// Universe returns the stored universe facts plus Epic A's derived universe time:
// the latest launched memory's created_universe_time, taken from the same read
// snapshot as the facts (a separate latest-launched query could race a launch).
func (s *Service) Universe(ctx context.Context, scope platform.UserScope) (UniverseFacts, *time.Time, error) {
	if scope.UserID() == "" {
		return UniverseFacts{}, nil, ErrScopeRequired
	}
	facts, err := s.universe.GetUniverse(ctx, scope)
	if err != nil {
		return UniverseFacts{}, nil, err
	}
	var universeTime *time.Time
	for _, episodicMemory := range facts.EpisodicMemories {
		created := episodicMemory.CreatedUniverseTime
		if universeTime == nil || created.After(*universeTime) {
			universeTime = &created
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

func (s *Service) enqueue(ctx context.Context, scope platform.UserScope, tx LaunchTx, kind JobKind, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	now := s.now()
	_, err = tx.EnqueueJob(ctx, scope, Job{
		ID:        s.newID(),
		UserID:    scope.UserID(),
		Kind:      kind,
		Payload:   raw,
		Status:    JobStatusPending,
		NextRunAt: now,
		CreatedAt: now,
	})
	return err
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

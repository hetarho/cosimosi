package pg

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrUserScopeRequired = errors.New("memory store requires authenticated user scope")
	ErrQueriesRequired   = errors.New("memory store requires database queries")
)

type Store struct {
	queries *dbgen.Queries
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	store := Store{queries: dbgen.New(db)}
	if txer, ok := db.(txStarter); ok {
		store.txer = txer
	}
	return store
}

func (s Store) InsertDiary(ctx context.Context, scope platform.UserScope, diary memory.Diary) (memory.Diary, error) {
	if err := s.ready(scope); err != nil {
		return memory.Diary{}, err
	}
	row, err := s.queries.InsertDiary(ctx, dbgen.InsertDiaryParams{
		ID:        diary.ID,
		UserID:    scope.UserID(),
		Body:      diary.Body,
		DiaryDate: pgDate(diary.DiaryDate),
		CreatedAt: pgTime(timeOrNow(diary.CreatedAt)),
	})
	if err != nil {
		return memory.Diary{}, err
	}
	return mapDiary(row), nil
}

func (s Store) InsertEpisodicMemory(ctx context.Context, scope platform.UserScope, episodicMemory memory.EpisodicMemory) (memory.EpisodicMemory, error) {
	if err := s.ready(scope); err != nil {
		return memory.EpisodicMemory{}, err
	}
	row, err := s.queries.InsertEpisodicMemory(ctx, dbgen.InsertEpisodicMemoryParams{
		ID:                       episodicMemory.ID,
		UserID:                   scope.UserID(),
		DiaryID:                  episodicMemory.DiaryID,
		Name:                     episodicMemory.Name,
		CurrentText:              episodicMemory.CurrentText,
		Seed:                     pgInt8(episodicMemory.Seed),
		Mood:                     string(episodicMemory.Emotion.Mood),
		Valence:                  float32(episodicMemory.Emotion.Valence),
		Arousal:                  float32(episodicMemory.Emotion.Arousal),
		Intensity:                float32(episodicMemory.Emotion.Intensity),
		BaseStrength:             float32(episodicMemory.BaseStrength),
		RecallCount:              episodicMemory.RecallCount,
		CreatedUniverseTime:      pgDate(episodicMemory.CreatedUniverseTime),
		LastRecalledUniverseTime: pgDatePtr(episodicMemory.LastRecalledUniverseTime),
		SemanticStage:            episodicMemory.SemanticStage,
		SemanticizeTimerResetAt:  pgDatePtr(episodicMemory.SemanticizeTimerResetAt),
	})
	if err != nil {
		return memory.EpisodicMemory{}, err
	}
	return mapEpisodicMemory(row), nil
}

func (s Store) UpsertNeuron(ctx context.Context, scope platform.UserScope, neuron memory.Neuron) (memory.Neuron, error) {
	if err := s.ready(scope); err != nil {
		return memory.Neuron{}, err
	}
	row, err := s.queries.UpsertNeuron(ctx, dbgen.UpsertNeuronParams{
		ID:         neuron.ID,
		UserID:     scope.UserID(),
		Name:       pgText(neuron.Name),
		NeuronType: string(neuron.Type),
		CreatedAt:  pgTime(timeOrNow(neuron.CreatedAt)),
		SealedAt:   pgTimePtr(neuron.SealedAt),
	})
	if err != nil {
		return memory.Neuron{}, err
	}
	return mapNeuron(row), nil
}

func (s Store) InsertNeuronActivation(ctx context.Context, scope platform.UserScope, activation memory.NeuronActivation) (memory.NeuronActivation, error) {
	if err := s.ready(scope); err != nil {
		return memory.NeuronActivation{}, err
	}
	row, err := s.queries.InsertNeuronActivation(ctx, dbgen.InsertNeuronActivationParams{
		EpisodicMemoryID: activation.EpisodicMemoryID,
		NeuronID:         activation.NeuronID,
		UserID:           scope.UserID(),
		Weight:           activation.Weight,
	})
	if err != nil {
		return memory.NeuronActivation{}, err
	}
	return mapNeuronActivation(row), nil
}

func (s Store) UpsertSynapse(ctx context.Context, scope platform.UserScope, synapse memory.Synapse) (memory.Synapse, error) {
	params, err := synapseParams(scope, synapse)
	if err != nil {
		return memory.Synapse{}, err
	}
	if s.queries == nil {
		return memory.Synapse{}, ErrQueriesRequired
	}
	row, err := s.queries.UpsertSynapse(ctx, params)
	if err != nil {
		return memory.Synapse{}, err
	}
	return mapSynapse(row), nil
}

func (s Store) InsertEmbedding(ctx context.Context, scope platform.UserScope, embedding memory.Embedding) (memory.Embedding, error) {
	if err := s.ready(scope); err != nil {
		return memory.Embedding{}, err
	}
	vector, err := vectorLiteral(embedding.Vector)
	if err != nil {
		return memory.Embedding{}, err
	}
	row, err := s.queries.InsertEmbedding(ctx, dbgen.InsertEmbeddingParams{
		NeuronID: embedding.NeuronID,
		UserID:   scope.UserID(),
		Column3:  vector,
	})
	if err != nil {
		return memory.Embedding{}, err
	}
	return mapEmbedding(row)
}

func (s Store) EnqueueJob(ctx context.Context, scope platform.UserScope, job memory.Job) (memory.Job, error) {
	if err := s.ready(scope); err != nil {
		return memory.Job{}, err
	}
	row, err := s.queries.EnqueueJob(ctx, dbgen.EnqueueJobParams{
		ID:        job.ID,
		UserID:    scope.UserID(),
		Kind:      string(job.Kind),
		Payload:   job.Payload,
		Status:    string(job.Status),
		Attempts:  job.Attempts,
		NextRunAt: pgTime(timeOrNow(job.NextRunAt)),
		CreatedAt: pgTime(timeOrNow(job.CreatedAt)),
	})
	if err != nil {
		return memory.Job{}, err
	}
	return mapJob(row), nil
}

func (s Store) GetUniverse(ctx context.Context, scope platform.UserScope) (memory.UniverseFacts, error) {
	if err := s.ready(scope); err != nil {
		return memory.UniverseFacts{}, err
	}

	if s.txer != nil {
		tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{
			IsoLevel:   pgx.RepeatableRead,
			AccessMode: pgx.ReadOnly,
		})
		if err != nil {
			return memory.UniverseFacts{}, err
		}
		defer func() {
			_ = tx.Rollback(ctx)
		}()

		facts, err := getUniverse(ctx, scope, s.queries.WithTx(tx))
		if err != nil {
			return memory.UniverseFacts{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return memory.UniverseFacts{}, err
		}
		return facts, nil
	}

	return getUniverse(ctx, scope, s.queries)
}

func getUniverse(ctx context.Context, scope platform.UserScope, queries *dbgen.Queries) (memory.UniverseFacts, error) {
	userID := scope.UserID()
	memories, err := queries.ListUniverseEpisodicMemories(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	neurons, err := queries.ListUniverseNeurons(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	activations, err := queries.ListUniverseNeuronActivations(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	synapses, err := queries.ListUniverseSynapses(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}

	return memory.UniverseFacts{
		EpisodicMemories: mapEpisodicMemories(memories),
		Neurons:          mapNeuronsWithConnectivity(neurons),
		Activations:      mapNeuronActivations(activations),
		Synapses:         mapSynapses(synapses),
	}, nil
}

func (s Store) ready(scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	if s.queries == nil {
		return ErrQueriesRequired
	}
	return nil
}

func synapseParams(scope platform.UserScope, synapse memory.Synapse) (dbgen.UpsertSynapseParams, error) {
	if scope.UserID() == "" {
		return dbgen.UpsertSynapseParams{}, ErrUserScopeRequired
	}
	ordered, err := canonicalSynapse(synapse)
	if err != nil {
		return dbgen.UpsertSynapseParams{}, err
	}
	return dbgen.UpsertSynapseParams{
		ID:                        ordered.ID,
		UserID:                    scope.UserID(),
		NeuronAID:                 ordered.NeuronAID,
		NeuronBID:                 ordered.NeuronBID,
		Strength:                  ordered.Strength,
		CoActivationCount:         ordered.CoActivationCount,
		LastActivatedUniverseTime: pgDate(ordered.LastActivatedUniverseTime),
		CreatedAt:                 pgTime(timeOrNow(ordered.CreatedAt)),
	}, nil
}

func canonicalSynapse(synapse memory.Synapse) (memory.Synapse, error) {
	if synapse.NeuronAID == "" || synapse.NeuronBID == "" {
		return memory.Synapse{}, errors.New("synapse requires both neuron ids")
	}
	if synapse.NeuronAID == synapse.NeuronBID {
		return memory.Synapse{}, errors.New("synapse requires two distinct neurons")
	}
	if synapse.NeuronAID < synapse.NeuronBID {
		return synapse, nil
	}
	synapse.NeuronAID, synapse.NeuronBID = synapse.NeuronBID, synapse.NeuronAID
	return synapse, nil
}

func mapDiary(row dbgen.InsertDiaryRow) memory.Diary {
	return memory.Diary{
		ID:        row.ID,
		Body:      row.Body,
		DiaryDate: dateValue(row.DiaryDate),
		CreatedAt: timeValue(row.CreatedAt),
	}
}

func mapEpisodicMemory(row dbgen.InsertEpisodicMemoryRow) memory.EpisodicMemory {
	return memory.EpisodicMemory{
		ID:          row.ID,
		DiaryID:     row.DiaryID,
		Name:        row.Name,
		CurrentText: row.CurrentText,
		Seed:        int64Ptr(row.Seed),
		Emotion: memory.Emotion{
			Mood:      memory.Mood(row.Mood),
			Valence:   float64(row.Valence),
			Arousal:   float64(row.Arousal),
			Intensity: float64(row.Intensity),
		},
		BaseStrength:             float64(row.BaseStrength),
		RecallCount:              row.RecallCount,
		CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
		LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
		SemanticStage:            row.SemanticStage,
		SemanticizeTimerResetAt:  datePtr(row.SemanticizeTimerResetAt),
		DeletedAt:                timePtr(row.DeletedAt),
	}
}

func mapEpisodicMemoryRead(row dbgen.ListUniverseEpisodicMemoriesRow) memory.EpisodicMemory {
	return memory.EpisodicMemory{
		ID:          row.ID,
		DiaryID:     row.DiaryID,
		Name:        row.Name,
		CurrentText: row.CurrentText,
		Seed:        int64Ptr(row.Seed),
		Emotion: memory.Emotion{
			Mood:      memory.Mood(row.Mood),
			Valence:   float64(row.Valence),
			Arousal:   float64(row.Arousal),
			Intensity: float64(row.Intensity),
		},
		BaseStrength:             float64(row.BaseStrength),
		RecallCount:              row.RecallCount,
		CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
		LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
		SemanticStage:            row.SemanticStage,
		SemanticizeTimerResetAt:  datePtr(row.SemanticizeTimerResetAt),
		DeletedAt:                timePtr(row.DeletedAt),
	}
}

func mapNeuron(row dbgen.UpsertNeuronRow) memory.Neuron {
	return memory.Neuron{
		ID:        row.ID,
		Name:      textPtr(row.Name),
		Type:      memory.NeuronType(row.NeuronType),
		CreatedAt: timeValue(row.CreatedAt),
		SealedAt:  timePtr(row.SealedAt),
	}
}

func mapNeuronRead(row dbgen.ListUniverseNeuronsRow) memory.NeuronWithConnectivity {
	return memory.NeuronWithConnectivity{
		Neuron: memory.Neuron{
			ID:        row.ID,
			Name:      textPtr(row.Name),
			Type:      memory.NeuronType(row.NeuronType),
			CreatedAt: timeValue(row.CreatedAt),
			SealedAt:  timePtr(row.SealedAt),
		},
		Connectivity: row.Connectivity,
	}
}

func mapNeuronActivation(row dbgen.InsertNeuronActivationRow) memory.NeuronActivation {
	return memory.NeuronActivation{
		EpisodicMemoryID: row.EpisodicMemoryID,
		NeuronID:         row.NeuronID,
		Weight:           row.Weight,
	}
}

func mapNeuronActivationRead(row dbgen.ListUniverseNeuronActivationsRow) memory.NeuronActivation {
	return memory.NeuronActivation{
		EpisodicMemoryID: row.EpisodicMemoryID,
		NeuronID:         row.NeuronID,
		Weight:           row.Weight,
	}
}

func mapSynapse(row dbgen.UpsertSynapseRow) memory.Synapse {
	return memory.Synapse{
		ID:                        row.ID,
		NeuronAID:                 row.NeuronAID,
		NeuronBID:                 row.NeuronBID,
		Strength:                  row.Strength,
		CoActivationCount:         row.CoActivationCount,
		LastActivatedUniverseTime: dateValue(row.LastActivatedUniverseTime),
		CreatedAt:                 timeValue(row.CreatedAt),
	}
}

func mapSynapseRead(row dbgen.ListUniverseSynapsesRow) memory.Synapse {
	return memory.Synapse{
		ID:                        row.ID,
		NeuronAID:                 row.NeuronAID,
		NeuronBID:                 row.NeuronBID,
		Strength:                  row.Strength,
		CoActivationCount:         row.CoActivationCount,
		LastActivatedUniverseTime: dateValue(row.LastActivatedUniverseTime),
		CreatedAt:                 timeValue(row.CreatedAt),
	}
}

func mapEmbedding(row dbgen.InsertEmbeddingRow) (memory.Embedding, error) {
	vector, err := parseVectorLiteral(row.Vector)
	if err != nil {
		return memory.Embedding{}, err
	}
	return memory.Embedding{
		NeuronID: row.NeuronID,
		Vector:   vector,
	}, nil
}

func mapJob(row dbgen.EnqueueJobRow) memory.Job {
	return memory.Job{
		ID:        row.ID,
		Kind:      memory.JobKind(row.Kind),
		Payload:   row.Payload,
		Status:    memory.JobStatus(row.Status),
		Attempts:  row.Attempts,
		NextRunAt: timeValue(row.NextRunAt),
		CreatedAt: timeValue(row.CreatedAt),
	}
}

func mapEpisodicMemories(rows []dbgen.ListUniverseEpisodicMemoriesRow) []memory.EpisodicMemory {
	items := make([]memory.EpisodicMemory, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapEpisodicMemoryRead(row))
	}
	return items
}

func mapNeuronsWithConnectivity(rows []dbgen.ListUniverseNeuronsRow) []memory.NeuronWithConnectivity {
	items := make([]memory.NeuronWithConnectivity, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNeuronRead(row))
	}
	return items
}

func mapNeuronActivations(rows []dbgen.ListUniverseNeuronActivationsRow) []memory.NeuronActivation {
	items := make([]memory.NeuronActivation, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNeuronActivationRead(row))
	}
	return items
}

func mapSynapses(rows []dbgen.ListUniverseSynapsesRow) []memory.Synapse {
	items := make([]memory.Synapse, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapSynapseRead(row))
	}
	return items
}

func vectorLiteral(vector []float32) (string, error) {
	if len(vector) != values.AiEmbeddingDim {
		return "", fmt.Errorf("embedding vector dimension = %d, want %d", len(vector), values.AiEmbeddingDim)
	}
	var out strings.Builder
	out.WriteByte('[')
	for i, value := range vector {
		if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
			return "", errors.New("embedding vector values must be finite")
		}
		if i > 0 {
			out.WriteByte(',')
		}
		out.WriteString(strconv.FormatFloat(float64(value), 'g', -1, 32))
	}
	out.WriteByte(']')
	return out.String(), nil
}

func parseVectorLiteral(raw string) ([]float32, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "[]" {
		return []float32{}, nil
	}
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return nil, fmt.Errorf("invalid pgvector literal %q", raw)
	}
	body := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "["), "]"))
	if body == "" {
		return []float32{}, nil
	}
	parts := strings.Split(body, ",")
	vector := make([]float32, 0, len(parts))
	for _, part := range parts {
		value, err := strconv.ParseFloat(strings.TrimSpace(part), 32)
		if err != nil {
			return nil, err
		}
		vector = append(vector, float32(value))
	}
	return vector, nil
}

func pgDate(value time.Time) pgtype.Date {
	return pgtype.Date{Time: dateOnly(value), Valid: true}
}

func pgDatePtr(value *time.Time) pgtype.Date {
	if value == nil {
		return pgtype.Date{}
	}
	return pgDate(*value)
}

func pgTime(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func pgTimePtr(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgTime(*value)
}

func pgInt8(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func pgText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func dateValue(value pgtype.Date) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return dateOnly(value.Time)
}

func datePtr(value pgtype.Date) *time.Time {
	if !value.Valid {
		return nil
	}
	date := dateOnly(value.Time)
	return &date
}

func timeValue(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time.UTC()
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time.UTC()
	return &t
}

func int64Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func dateOnly(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func timeOrNow(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value.UTC()
}

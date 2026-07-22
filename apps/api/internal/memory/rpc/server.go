// Package rpc is the memory context's transport adapter: thin Connect handlers
// that map proto DTOs to domain inputs and call the use-cases (ARCHITECTURE
// §2.7/§2.9#7). No policy lives here.
package rpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

var ErrServiceRequired = errors.New("memory rpc server requires the memory service")

type Server struct {
	service *memory.Service
}

func NewServer(service *memory.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) SplitDiary(ctx context.Context, req *connect.Request[memoryv1.SplitDiaryRequest]) (*connect.Response[memoryv1.SplitDiaryResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	diaryDate, err := parseDiaryDate(req.Msg.GetDiaryDate())
	if err != nil {
		return nil, err
	}
	result, err := s.service.Encode(ctx, scope, req.Msg.GetBody(), diaryDate)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(splitResponse(result)), nil
}

func (s *Server) ReviseSplit(ctx context.Context, req *connect.Request[memoryv1.ReviseSplitRequest]) (*connect.Response[memoryv1.SplitDiaryResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	previous := memory.ExtractResult{Memories: domainMemories(req.Msg.GetPrevious().GetMemories())}
	result, err := s.service.ReviseSplit(ctx, scope, previous, req.Msg.GetInstruction())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(splitResponse(result)), nil
}

func (s *Server) LaunchStars(ctx context.Context, req *connect.Request[memoryv1.LaunchStarsRequest]) (*connect.Response[memoryv1.LaunchStarsResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	diaryDate, err := parseDiaryDate(req.Msg.GetDiaryDate())
	if err != nil {
		return nil, err
	}
	confirmed := domainMemories(req.Msg.GetMemories())
	result, err := s.service.PersistEncoded(ctx, scope, req.Msg.GetBody(), diaryDate, confirmed)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.LaunchStarsResponse{
		MemoryIds:            result.MemoryIDs,
		NewNeuronIds:         result.NewNeuronIDs,
		PastDated:            result.PastDated,
		PreviousUniverseTime: dateValue(result.PreviousUniverseTime),
		UniverseTime:         dateValue(result.UniverseTime),
	}), nil
}

func (s *Server) GetUniverse(ctx context.Context, _ *connect.Request[memoryv1.GetUniverseRequest]) (*connect.Response[memoryv1.GetUniverseResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	facts, universeTime, err := s.service.Universe(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(universeResponse(facts, universeTime)), nil
}

func (s *Server) Recall(ctx context.Context, req *connect.Request[memoryv1.RecallRequest]) (*connect.Response[memoryv1.RecallResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.Recall(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetMemoryId(), req.Msg.GetRewriteText(), req.Msg.GetSyncConsent())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.RecallResponse{
		Reconsolidated:       result.Reconsolidated,
		CurrentText:          result.CurrentText,
		Seed:                 result.Seed,
		RecallCount:          result.RecallCount,
		EffectiveStrength:    float32(result.EffectiveStrength),
		PreviousUniverseTime: dateValue(result.Sync.Previous),
		UniverseTime:         result.Sync.Current.Format(time.DateOnly),
	}), nil
}

func (s *Server) RecallDiaryStars(ctx context.Context, req *connect.Request[memoryv1.RecallDiaryStarsRequest]) (*connect.Response[memoryv1.RecallDiaryStarsResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.RecallDiaryStars(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetDiaryId(), req.Msg.GetSyncConsent())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.RecallDiaryStarsResponse{
		DiaryId:              result.DiaryID,
		EpisodicMemoryIds:    result.EpisodicMemoryIDs,
		PreviousUniverseTime: dateValue(result.Sync.Previous),
		UniverseTime:         result.Sync.Current.Format(time.DateOnly),
	}), nil
}

func (s *Server) ViewSemantic(ctx context.Context, req *connect.Request[memoryv1.ViewSemanticRequest]) (*connect.Response[memoryv1.ViewSemanticResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.ViewSemantic(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetEpisodicMemoryId(), int(req.Msg.GetStage()))
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.ViewSemanticResponse{
		Text:         result.Text,
		Stage:        int32(result.Stage),
		ReachedStage: int32(result.ReachedStage),
	}), nil
}

func (s *Server) SyncStatus(ctx context.Context, _ *connect.Request[memoryv1.SyncStatusRequest]) (*connect.Response[memoryv1.SyncStatusResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	status, err := s.service.SyncStatus(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.SyncStatusResponse{
		Today:     status.Today.Format(time.DateOnly),
		NeedsSync: status.NeedsSync,
	}), nil
}

func (s *Server) GetProvenance(ctx context.Context, req *connect.Request[memoryv1.GetProvenanceRequest]) (*connect.Response[memoryv1.GetProvenanceResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	entries, err := s.service.GetProvenance(ctx, scope, req.Msg.GetEpisodicMemoryId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.GetProvenanceResponse{Entries: provenanceEntries(entries)}), nil
}

func (s *Server) Export(ctx context.Context, req *connect.Request[memoryv1.ExportRequest]) (*connect.Response[memoryv1.ExportResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	format, err := domainExportFormat(req.Msg.GetFormat())
	if err != nil {
		return nil, err
	}
	result, err := s.service.Export(ctx, scope, format)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.ExportResponse{
		Content:     result.Content,
		ContentType: result.ContentType,
		Filename:    result.Filename,
	}), nil
}

func (s *Server) GetDiaries(ctx context.Context, req *connect.Request[memoryv1.GetDiariesRequest]) (*connect.Response[memoryv1.GetDiariesResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	page, err := s.service.GetDiaries(ctx, scope, int(req.Msg.GetPageSize()), req.Msg.GetPageToken())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(diariesResponse(page)), nil
}

func (s *Server) Release(ctx context.Context, req *connect.Request[memoryv1.ReleaseRequest]) (*connect.Response[memoryv1.ReleaseResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.Release(ctx, scope, req.Msg.GetDiaryId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.ReleaseResponse{
		DiaryId:           result.DiaryID,
		EpisodicMemoryIds: result.EpisodicMemoryIDs,
		DeletedAt:         result.DeletedAt.UTC().Format(time.RFC3339),
	}), nil
}

func (s *Server) Restore(ctx context.Context, req *connect.Request[memoryv1.RestoreRequest]) (*connect.Response[memoryv1.RestoreResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.Restore(ctx, scope, req.Msg.GetDiaryId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.RestoreResponse{
		DiaryId:           result.DiaryID,
		EpisodicMemoryIds: result.EpisodicMemoryIDs,
	}), nil
}

func (s *Server) SuggestLetGo(ctx context.Context, req *connect.Request[memoryv1.SuggestLetGoRequest]) (*connect.Response[memoryv1.SuggestLetGoResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.SuggestLetGo(ctx, scope, req.Msg.GetEpisodicMemoryId(), req.Msg.GetWords())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.SuggestLetGoResponse{
		Candidates: sealCandidates(result.Candidates),
		HeavyState: &memoryv1.HeavyState{Detected: result.HeavyState.Detected, Severity: result.HeavyState.Severity},
	}), nil
}

func (s *Server) LetGo(ctx context.Context, req *connect.Request[memoryv1.LetGoRequest]) (*connect.Response[memoryv1.LetGoResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.service.LetGo(ctx, scope, req.Msg.GetEpisodicMemoryId(), req.Msg.GetApprovedNeuronIds())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.LetGoResponse{SealedNeuronIds: result.SealedNeuronIDs}), nil
}

func sealCandidates(candidates []memory.SealCandidate) []*memoryv1.SealCandidate {
	out := make([]*memoryv1.SealCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		out = append(out, &memoryv1.SealCandidate{
			NeuronId: candidate.NeuronID,
			Name:     candidate.Name,
			Reason:   candidate.Reason,
		})
	}
	return out
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, connect.NewError(connect.CodeUnauthenticated, err)
	}
	return scope, nil
}

func parseDiaryDate(raw string) (time.Time, error) {
	diaryDate, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, connect.NewError(connect.CodeInvalidArgument, err)
	}
	return diaryDate, nil
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, memory.ErrEncodeInputRequired),
		errors.Is(err, memory.ErrLaunchInvalidMemories),
		errors.Is(err, memory.ErrRecallInputRequired),
		errors.Is(err, memory.ErrViewSemanticInputRequired),
		errors.Is(err, memory.ErrProvenanceInputRequired),
		errors.Is(err, memory.ErrExportFormatRequired),
		errors.Is(err, memory.ErrDiaryPageTokenInvalid),
		errors.Is(err, memory.ErrReleaseInputRequired),
		errors.Is(err, memory.ErrLetGoInvalidApproved),
		errors.Is(err, memory.ErrOperationIDRequired):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, memory.ErrOperationConflict):
		// Same client operation id, different canonical input (A2): replaying the receipt
		// would return the wrong result, so the client must mint a fresh id.
		return connect.NewError(connect.CodeAlreadyExists, err)
	case errors.Is(err, memory.ErrRecallMemoryNotFound),
		errors.Is(err, memory.ErrRecallNoLiveMemories),
		errors.Is(err, memory.ErrViewSemanticMemoryNotFound),
		errors.Is(err, memory.ErrProvenanceMemoryNotFound),
		errors.Is(err, memory.ErrReleaseMemoryNotFound),
		errors.Is(err, memory.ErrReleaseNoLiveMemories),
		errors.Is(err, memory.ErrRestoreNotReleased):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, memory.ErrRecallMemoryUnavailable),
		errors.Is(err, memory.ErrViewSemanticStageNotRisen),
		errors.Is(err, memory.ErrReleaseMemoryUnavailable),
		errors.Is(err, memory.ErrAlreadyReleased),
		errors.Is(err, memory.ErrRestoreWindowExpired),
		errors.Is(err, memory.ErrSyncConsentRequired):
		// Consent-required is a pre-spend precondition failure (A1/A5): nothing was charged, so
		// the client safely refreshes sync-status and shows the consent modal before retrying.
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, memory.ErrInsufficientTwinkle):
		return connect.NewError(connect.CodeResourceExhausted, err)
	case errors.Is(err, memory.ErrEncodeRetryExhausted):
		return connect.NewError(connect.CodeResourceExhausted, err)
	case errors.Is(err, memory.ErrEncodeInvalidSplit):
		// An extractor adapter emitting an out-of-schema shape is a server-side
		// contract breach, not a client mistake.
		return connect.NewError(connect.CodeInternal, err)
	case errors.Is(err, memory.ErrConsolidateTxRequired):
		// A progression transaction that cannot consolidate is a composition-root
		// wiring fault, never a client mistake.
		return connect.NewError(connect.CodeInternal, err)
	case errors.Is(err, memory.ErrScopeRequired):
		return connect.NewError(connect.CodeUnauthenticated, err)
	default:
		return err
	}
}

// memoryDto abstracts ProposedMemory/ConfirmedMemory — one wire shape, one
// mapping: the preview and the launch must never map the same fields differently.
type memoryDto interface {
	GetName() string
	GetMood() string
	GetNeurons() []*memoryv1.ProposedNeuron
}

func domainMemories[T memoryDto](items []T) []memory.ExtractedMemory {
	memories := make([]memory.ExtractedMemory, 0, len(items))
	for _, item := range items {
		memories = append(memories, memory.ExtractedMemory{
			Name:    item.GetName(),
			Mood:    memory.Mood(item.GetMood()),
			Neurons: domainNeurons(item.GetNeurons()),
		})
	}
	return memories
}

func domainNeurons(proposed []*memoryv1.ProposedNeuron) []memory.ExtractedNeuron {
	neurons := make([]memory.ExtractedNeuron, 0, len(proposed))
	for _, item := range proposed {
		neurons = append(neurons, memory.ExtractedNeuron{
			Name: item.GetName(),
			Type: memory.NeuronType(item.GetType()),
		})
	}
	return neurons
}

// provenanceEntries maps the domain variant history onto the wire DTOs: kind/source carried as their
// bare enum strings (as the FE narrows them), universe_time as an ISO DATE. Baseline-first ordering is
// the use-case's, preserved here.
func provenanceEntries(entries []memory.ProvenanceEntry) []*memoryv1.ProvenanceEntry {
	out := make([]*memoryv1.ProvenanceEntry, 0, len(entries))
	for _, entry := range entries {
		out = append(out, &memoryv1.ProvenanceEntry{
			Kind:         string(entry.Kind),
			Source:       string(entry.Source),
			Text:         entry.Text,
			UniverseTime: entry.UniverseTime.Format(time.DateOnly),
		})
	}
	return out
}

// diariesResponse maps one archive page onto the wire DTOs: the verbatim body, ISO-DATE fields
// (created_universe_time empty-until-set for a memory-less diary), and the split refs (mood as its bare
// enum name, mapped to a color client-side).
func diariesResponse(page memory.DiaryPage) *memoryv1.GetDiariesResponse {
	diaries := make([]*memoryv1.DiaryDto, 0, len(page.Diaries))
	for _, diary := range page.Diaries {
		refs := make([]*memoryv1.DiarySplitRef, 0, len(diary.Memories))
		for _, ref := range diary.Memories {
			refs = append(refs, &memoryv1.DiarySplitRef{
				EpisodicMemoryId: ref.EpisodicMemoryID,
				Name:             ref.Name,
				Mood:             string(ref.Mood),
			})
		}
		diaries = append(diaries, &memoryv1.DiaryDto{
			Id:                  diary.ID,
			Body:                diary.Body,
			DiaryDate:           diary.DiaryDate.Format(time.DateOnly),
			CreatedUniverseTime: dateValue(diary.CreatedUniverseTime),
			Memories:            refs,
		})
	}
	return &memoryv1.GetDiariesResponse{Diaries: diaries, NextPageToken: page.NextPageToken}
}

// domainExportFormat maps the proto ExportFormat enum onto the domain format; an unspecified/unknown
// value is a client mistake (§2.9#7 — the enum↔domain map is the handler's, the read policy the
// use-case's).
func domainExportFormat(format memoryv1.ExportFormat) (memory.ExportFormat, error) {
	switch format {
	case memoryv1.ExportFormat_EXPORT_FORMAT_CSV:
		return memory.ExportFormatCSV, nil
	case memoryv1.ExportFormat_EXPORT_FORMAT_MD:
		return memory.ExportFormatMD, nil
	default:
		return "", connect.NewError(connect.CodeInvalidArgument, memory.ErrExportFormatRequired)
	}
}

func splitResponse(result memory.ExtractResult) *memoryv1.SplitDiaryResponse {
	memories := make([]*memoryv1.ProposedMemory, 0, len(result.Memories))
	for _, extracted := range result.Memories {
		neurons := make([]*memoryv1.ProposedNeuron, 0, len(extracted.Neurons))
		for _, neuron := range extracted.Neurons {
			neurons = append(neurons, &memoryv1.ProposedNeuron{
				Name: neuron.Name,
				Type: string(neuron.Type),
			})
		}
		memories = append(memories, &memoryv1.ProposedMemory{
			Name:    extracted.Name,
			Mood:    string(extracted.Mood),
			Neurons: neurons,
		})
	}
	return &memoryv1.SplitDiaryResponse{Memories: memories}
}

func universeResponse(facts memory.UniverseFacts, universeTime *time.Time) *memoryv1.GetUniverseResponse {
	activationsByMemory := make(map[string][]*memoryv1.NeuronActivationDto, len(facts.EpisodicMemories))
	for _, activation := range facts.Activations {
		activationsByMemory[activation.EpisodicMemoryID] = append(
			activationsByMemory[activation.EpisodicMemoryID],
			&memoryv1.NeuronActivationDto{
				NeuronId: activation.NeuronID,
				Weight:   activation.Weight,
			},
		)
	}

	memories := make([]*memoryv1.EpisodicMemoryDto, 0, len(facts.EpisodicMemories))
	for _, episodicMemory := range facts.EpisodicMemories {
		memories = append(memories, &memoryv1.EpisodicMemoryDto{
			Id:   episodicMemory.ID,
			Name: episodicMemory.Name,
			Emotion: &memoryv1.EmotionDto{
				Mood:      string(episodicMemory.Emotion.Mood),
				Valence:   episodicMemory.Emotion.Valence,
				Arousal:   episodicMemory.Emotion.Arousal,
				Intensity: episodicMemory.Emotion.Intensity,
			},
			BaseStrength:             episodicMemory.BaseStrength,
			RecallCount:              episodicMemory.RecallCount,
			CreatedUniverseTime:      episodicMemory.CreatedUniverseTime.Format(time.DateOnly),
			LastRecalledUniverseTime: dateString(episodicMemory.LastRecalledUniverseTime),
			Seed:                     episodicMemory.Seed,
			Activations:              activationsByMemory[episodicMemory.ID],
			DecayStages:              episodicMemory.DecayStages,
			ForgettingOffsetDays:     episodicMemory.ForgettingOffsetDays,
			CurrentText:              episodicMemory.CurrentText,
			SemanticStage:            int32(episodicMemory.SemanticStage),
		})
	}

	neurons := make([]*memoryv1.NeuronDto, 0, len(facts.Neurons))
	for _, neuron := range facts.Neurons {
		neurons = append(neurons, &memoryv1.NeuronDto{
			Id:           neuron.ID,
			Name:         neuron.Name,
			NeuronType:   string(neuron.Type),
			Connectivity: neuron.Connectivity,
		})
	}

	synapses := make([]*memoryv1.SynapseDto, 0, len(facts.Synapses))
	for _, synapse := range facts.Synapses {
		synapses = append(synapses, &memoryv1.SynapseDto{
			Id:                        synapse.ID,
			NeuronAId:                 synapse.NeuronAID,
			NeuronBId:                 synapse.NeuronBID,
			Strength:                  synapse.Strength,
			CoActivationCount:         synapse.CoActivationCount,
			LastActivatedUniverseTime: synapse.LastActivatedUniverseTime.Format(time.DateOnly),
		})
	}

	response := &memoryv1.GetUniverseResponse{
		Memories: memories,
		Neurons:  neurons,
		Synapses: synapses,
	}
	if universeTime != nil {
		response.UniverseTime = universeTime.Format(time.DateOnly)
	}
	return response
}

func dateString(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := dateValue(value)
	return &formatted
}

// dateValue is the empty-until-set wire convention for plain-string DATE
// fields (the same one GetUniverseResponse.universe_time uses).
func dateValue(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format(time.DateOnly)
}

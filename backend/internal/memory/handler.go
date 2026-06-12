package memory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// Handler adapts proto ↔ domain for the MemoryService RPCs (RecordMemory, GetUniverse,
// ReinforceLinks, RecallMemory, ListDormant — all implemented below). The embedded
// UnimplementedMemoryServiceHandler is only a forward-compat shim for RPCs added to the
// proto but not yet handled. It stays thin: auth + mapping only, policy lives in Service.
type Handler struct {
	cosimosiv1connect.UnimplementedMemoryServiceHandler
	svc *Service
}

// NewHandler builds the Connect handler over the memory service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

var _ cosimosiv1connect.MemoryServiceHandler = (*Handler)(nil)

// segmentTimeout bounds the synchronous LLM call. The llm client's own timeout
// is 120s but rpcserver's WriteTimeout kills the response stream at 30s — a
// provider slower than this deadline would burn paid tokens for a response no
// client can receive, so fail fast (the preview persists nothing; retry is safe).
const segmentTimeout = 25 * time.Second

// SegmentMemory runs the synchronous extraction PREVIEW (no persistence): the
// diary body in, the AI's proposed fragments out, for the user to review/edit
// before RecordMemory commits the confirmed list. Body validation maps to
// InvalidArgument; an extraction failure is Unavailable (retryable — nothing
// was written).
func (h *Handler) SegmentMemory(ctx context.Context, req *connect.Request[cosimosiv1.SegmentMemoryRequest]) (*connect.Response[cosimosiv1.SegmentMemoryResponse], error) {
	_, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	ctx, cancel := context.WithTimeout(ctx, segmentTimeout)
	defer cancel()
	segs, err := h.svc.SegmentMemory(ctx, req.Msg.GetBody())
	switch {
	case errors.Is(err, ErrEmptyBody), errors.Is(err, ErrBodyTooLong):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeUnavailable, err)
	}
	out := make([]*cosimosiv1.SegmentDraft, 0, len(segs))
	for _, s := range segs {
		out = append(out, &cosimosiv1.SegmentDraft{
			Text:      s.Text,
			Mood:      moodToProto(s.Mood),
			Intensity: s.Intensity,
			Valence:   s.Valence,
		})
	}
	return connect.NewResponse(&cosimosiv1.SegmentMemoryResponse{Segments: out}), nil
}

// RecordMemory persists a diary entry and returns the immutable record id.
// With user-confirmed segments (review step) the fragment stars are persisted
// in the same transaction and memory_ids returns them; without, they arrive
// asynchronously via GetUniverse (spec 21, constitution §6) and memory_ids is
// empty. Requires an authenticated caller; an unset/invalid entry_date maps to
// InvalidArgument.
func (h *Handler) RecordMemory(ctx context.Context, req *connect.Request[cosimosiv1.RecordMemoryRequest]) (*connect.Response[cosimosiv1.RecordMemoryResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}

	msg := req.Msg
	entryDate, err := parseEntryDate(msg.GetEntryDate())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	segments := make([]SegmentInput, 0, len(msg.GetSegments()))
	for _, s := range msg.GetSegments() {
		segments = append(segments, SegmentInput{
			Text:      s.GetText(),
			Mood:      moodFromProto(s.GetMood()),
			Intensity: s.GetIntensity(),
			Valence:   s.GetValence(),
		})
	}

	recordID, memoryIDs, err := h.svc.RecordMemory(ctx, RecordInput{
		UserID:         userID,
		Body:           msg.GetBody(),
		EntryDate:      entryDate,
		Mood:           moodFromProto(msg.GetMood()),
		Intensity:      msg.GetIntensity(),
		Valence:        msg.GetValence(),
		IdempotencyKey: msg.GetIdempotencyKey(),
		Segments:       segments,
	})
	switch {
	// Validation sentinels → InvalidArgument (17): the client shows the message
	// to the user (use-record-memory maps it to Korean copy), so it must not be
	// blanket-coded Internal.
	case errors.Is(err, ErrEmptyBody), errors.Is(err, ErrBodyTooLong),
		errors.Is(err, ErrIntensityRange), errors.Is(err, ErrValenceRange),
		errors.Is(err, ErrEmptySegment), errors.Is(err, ErrSegmentTooLong),
		errors.Is(err, ErrTooManySegments):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&cosimosiv1.RecordMemoryResponse{RecordId: recordID, MemoryIds: memoryIDs}), nil
}

// GetUniverse returns the caller's full star + synapse graph (dormant included),
// with last_*_at as raw values — brightness/coordinates are computed client-side
// (constitution §2·§3).
func (h *Handler) GetUniverse(ctx context.Context, req *connect.Request[cosimosiv1.GetUniverseRequest]) (*connect.Response[cosimosiv1.GetUniverseResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}

	uni, err := h.svc.GetUniverse(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	stars := make([]*cosimosiv1.Star, 0, len(uni.Memories))
	for _, m := range uni.Memories {
		stars = append(stars, &cosimosiv1.Star{
			MemoryId:       m.ID,
			Mood:           moodToProto(m.Mood),
			Intensity:      m.Intensity,
			Valence:        m.Valence,
			LastRecalledAt: formatTime(m.LastRecalledAt),
		})
	}

	synapses := make([]*cosimosiv1.Synapse, 0, len(uni.Synapses))
	for _, s := range uni.Synapses {
		synapses = append(synapses, &cosimosiv1.Synapse{
			AId:             s.AID,
			BId:             s.BID,
			Weight:          s.Weight,
			LinkType:        s.LinkType,
			LastActivatedAt: formatTime(s.LastActivatedAt),
		})
	}

	return connect.NewResponse(&cosimosiv1.GetUniverseResponse{Stars: stars, Synapses: synapses}), nil
}

// ReinforceLinks applies a co-recall reinforcement batch. unary, idempotent
// by batch_id; pairs are normalized + summed in the service.
func (h *Handler) ReinforceLinks(ctx context.Context, req *connect.Request[cosimosiv1.ReinforceLinksRequest]) (*connect.Response[cosimosiv1.ReinforceLinksResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	msg := req.Msg
	deltas := make([]LinkDelta, 0, len(msg.GetItems()))
	for _, it := range msg.GetItems() {
		deltas = append(deltas, LinkDelta{AID: it.GetAId(), BID: it.GetBId(), DeltaWeight: it.GetDeltaWeight()})
	}
	if err := h.svc.ReinforceLinks(ctx, userID, msg.GetBatchId(), deltas); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.ReinforceLinksResponse{}), nil
}

// RecallMemory re-ignites a star and returns its immutable original Record (records
// JOIN). NotFound when the (user, memory) pair doesn't exist; never mutates the
// original (constitution §1).
func (h *Handler) RecallMemory(ctx context.Context, req *connect.Request[cosimosiv1.RecallMemoryRequest]) (*connect.Response[cosimosiv1.RecallMemoryResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	memoryID := req.Msg.GetMemoryId()
	rec, err := h.svc.RecallMemory(ctx, userID, memoryID)
	if errors.Is(err, ErrNotFound) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.RecallMemoryResponse{
		Record: &cosimosiv1.Record{
			MemoryId:  memoryID,
			Body:      rec.Body,
			EntryDate: rec.EntryDate.UTC().Format("2006-01-02"),
			Mood:      moodToProto(rec.Mood),
			Intensity: rec.Intensity,
			CreatedAt: formatTime(&rec.CreatedAt),
		},
	}), nil
}

// ListDormant returns the caller's long-unrecalled stars as Star (no body;
// the original is fetched on recall). The full graph is unaffected
// (GetUniverse still returns everything — constitution §2). An empty list is valid.
func (h *Handler) ListDormant(ctx context.Context, req *connect.Request[cosimosiv1.ListDormantRequest]) (*connect.Response[cosimosiv1.ListDormantResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	memories, err := h.svc.ListDormant(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	stars := make([]*cosimosiv1.Star, 0, len(memories))
	for _, m := range memories {
		stars = append(stars, &cosimosiv1.Star{
			MemoryId:       m.ID,
			Mood:           moodToProto(m.Mood),
			Intensity:      m.Intensity,
			Valence:        m.Valence,
			LastRecalledAt: formatTime(m.LastRecalledAt),
		})
	}
	return connect.NewResponse(&cosimosiv1.ListDormantResponse{Stars: stars}), nil
}

// parseEntryDate accepts "YYYY-MM-DD" or empty (→ zero time, service defaults to today).
func parseEntryDate(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid entry_date (want YYYY-MM-DD): %w", err)
	}
	return t, nil
}

// formatTime renders a nullable timestamp as RFC3339 UTC, or "" when nil.
func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func moodFromProto(m cosimosiv1.Mood) Mood {
	switch m {
	case cosimosiv1.Mood_JOY:
		return MoodJoy
	case cosimosiv1.Mood_CALM:
		return MoodCalm
	case cosimosiv1.Mood_SAD:
		return MoodSad
	case cosimosiv1.Mood_ANGER:
		return MoodAnger
	case cosimosiv1.Mood_FEAR:
		return MoodFear
	case cosimosiv1.Mood_LOVE:
		return MoodLove
	case cosimosiv1.Mood_NEUTRAL:
		return MoodNeutral
	case cosimosiv1.Mood_EXCITEMENT:
		return MoodExcitement
	case cosimosiv1.Mood_GRATITUDE:
		return MoodGratitude
	case cosimosiv1.Mood_RELIEF:
		return MoodRelief
	case cosimosiv1.Mood_STRESS:
		return MoodStress
	case cosimosiv1.Mood_TIRED:
		return MoodTired
	case cosimosiv1.Mood_EMPTINESS:
		return MoodEmptiness
	default:
		return MoodUnspecified
	}
}

func moodToProto(m Mood) cosimosiv1.Mood {
	switch m {
	case MoodJoy:
		return cosimosiv1.Mood_JOY
	case MoodCalm:
		return cosimosiv1.Mood_CALM
	case MoodSad:
		return cosimosiv1.Mood_SAD
	case MoodAnger:
		return cosimosiv1.Mood_ANGER
	case MoodFear:
		return cosimosiv1.Mood_FEAR
	case MoodLove:
		return cosimosiv1.Mood_LOVE
	case MoodNeutral:
		return cosimosiv1.Mood_NEUTRAL
	case MoodExcitement:
		return cosimosiv1.Mood_EXCITEMENT
	case MoodGratitude:
		return cosimosiv1.Mood_GRATITUDE
	case MoodRelief:
		return cosimosiv1.Mood_RELIEF
	case MoodStress:
		return cosimosiv1.Mood_STRESS
	case MoodTired:
		return cosimosiv1.Mood_TIRED
	case MoodEmptiness:
		return cosimosiv1.Mood_EMPTINESS
	default:
		return cosimosiv1.Mood_MOOD_UNSPECIFIED
	}
}

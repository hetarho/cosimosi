package ai

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/cosimosi/backend/internal/llm"
)

// switchTTL mirrors the llm resolver's TTL (spec 34, acceptance 2.1): an admin
// console activation/deactivation reaches extraction within ≤30s.
const switchTTL = 30 * time.Second

// SwitchingExtractor is the admin-controlled extractor (spec 34): each Extract
// asks the ConfigSource whether an LLM selection is ACTIVE and routes to the
// real LLM extractor when it is, the keyless mock when it isn't — so turning
// real AI extraction on/off is a console action, never an env change or a
// restart. The probe result is cached under switchTTL; a broken source keeps
// the last known route (never takes extraction down).
type SwitchingExtractor struct {
	src  llm.ConfigSource
	llm  Extractor
	mock Extractor

	mu        sync.Mutex
	active    bool
	expiresAt time.Time
}

// NewSwitchingExtractor wires the admin-followed switch over the two adapters.
func NewSwitchingExtractor(src llm.ConfigSource, llmExtractor, mock Extractor) *SwitchingExtractor {
	return &SwitchingExtractor{src: src, llm: llmExtractor, mock: mock}
}

func (s *SwitchingExtractor) Extract(ctx context.Context, text string) (Extraction, error) {
	if s.llmActive(ctx) {
		return s.llm.Extract(ctx, text)
	}
	return s.mock.Extract(ctx, text)
}

// llmActive reports whether the admin console has an active LLM selection,
// re-reading the source at most once per switchTTL. The decrypted key is
// discarded here — the resolver behind the LLM extractor does its own read.
func (s *SwitchingExtractor) llmActive(ctx context.Context) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if now.Before(s.expiresAt) {
		return s.active
	}
	_, _, _, ok, err := s.src.ActiveLLM(ctx)
	s.expiresAt = now.Add(switchTTL)
	if err != nil {
		// DB down / undecryptable key: keep the last known route — flapping to
		// mock on a transient outage would silently flatten real extractions.
		slog.Warn("switching extractor: config source failed; keeping last route", "active", s.active, "err", err)
		return s.active
	}
	s.active = ok
	return s.active
}

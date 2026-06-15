package share

import (
	"context"
	"strings"
	"unicode/utf8"
)

// Service owns the share policy: settings CRUD with slug minting/rotation (crypto/rand) and
// the public snapshot assembly (timestamp day-quantization, synapse-endpoint → index mapping,
// owner-appearance fold, uniform NotFound). It depends only on ports — no transport, no db.
type Service struct {
	repo      Repository
	settings  SettingsReader
	resonance ResonanceReader
}

// NewService wires the share service over its persistence Repository, a SettingsReader (the
// owner's spec-30 visual overrides) and a ResonanceReader (spec-36 resonances for the spec-37
// overlay) — both adapted from their owning services by the composition root.
func NewService(repo Repository, settings SettingsReader, resonance ResonanceReader) *Service {
	return &Service{repo: repo, settings: settings, resonance: resonance}
}

// GetSettings returns the owner's share configuration; a user who never shared gets the zero
// value (enabled=false, slug="").
func (s *Service) GetSettings(ctx context.Context, userID string) (Settings, error) {
	st, _, err := s.repo.GetByUser(ctx, userID)
	return st, err
}

// UpdateSettings sets enabled + display name. The FIRST enable mints a 128-bit slug
// (acceptance 1.4); an existing row keeps its slug (rotation is the only way to change it), so
// toggling off→on reuses the same URL. The display name is trimmed and bounded (17).
func (s *Service) UpdateSettings(ctx context.Context, userID string, enabled bool, displayName string) (Settings, error) {
	displayName = strings.TrimSpace(displayName)
	if utf8.RuneCountInString(displayName) > maxDisplayNameRunes {
		return Settings{}, ErrDisplayNameTooLong
	}
	cur, ok, err := s.repo.GetByUser(ctx, userID)
	if err != nil {
		return Settings{}, err
	}
	slug := cur.Slug
	if !ok || slug == "" {
		slug, err = newSlug()
		if err != nil {
			return Settings{}, err
		}
	}
	return s.repo.Upsert(ctx, userID, slug, enabled, displayName)
}

// RotateSlug issues a fresh slug, invalidating the old URL immediately (acceptance 1.3). A
// user who never enabled sharing has nothing to rotate → ErrNotShared.
func (s *Service) RotateSlug(ctx context.Context, userID string) (Settings, error) {
	slug, err := newSlug()
	if err != nil {
		return Settings{}, err
	}
	st, ok, err := s.repo.Rotate(ctx, userID, slug)
	if err != nil {
		return Settings{}, err
	}
	if !ok {
		return Settings{}, ErrNotShared
	}
	return st, nil
}

// Snapshot assembles the public landscape for an ENABLED slug, or ErrNotFound for an unknown
// or disabled slug (uniform — acceptance 1.2). Timestamps are quantized to UTC days; synapse
// endpoints are mapped to snapshot-array indices (ids never leave the server). The owner's
// visual settings are folded in best-effort — a settings read failure degrades to the client
// default rather than denying the (core) landscape graph.
func (s *Service) Snapshot(ctx context.Context, slug string) (Snapshot, error) {
	userID, displayName, ok, err := s.repo.UserBySlug(ctx, slug)
	if err != nil {
		return Snapshot{}, err
	}
	if !ok {
		return Snapshot{}, ErrNotFound
	}

	rawStars, err := s.repo.ListStars(ctx, userID)
	if err != nil {
		return Snapshot{}, err
	}
	rawSynapses, err := s.repo.ListSynapses(ctx, userID)
	if err != nil {
		return Snapshot{}, err
	}

	stars := make([]SharedStar, len(rawStars))
	indexByID := make(map[string]int, len(rawStars))
	for i, st := range rawStars {
		indexByID[st.ID] = i
		stars[i] = SharedStar{
			Mood:            st.Mood,
			Intensity:       st.Intensity,
			LastRecalledDay: toEpochDay(st.LastRecalledAt),
			CreatedDay:      toEpochDay(st.CreatedAt),
		}
	}

	synapses := make([]SharedSynapse, 0, len(rawSynapses))
	for _, syn := range rawSynapses {
		a, okA := indexByID[syn.AID]
		b, okB := indexByID[syn.BID]
		if !okA || !okB {
			continue // an endpoint not in the star set (shouldn't happen) — drop, never leak an id
		}
		synapses = append(synapses, SharedSynapse{A: a, B: b, Weight: syn.Weight})
	}

	// Owner appearance is decorative (constitution §3 — not the authoritative graph). Degrade to
	// the client default on a read failure rather than failing the whole snapshot.
	appearance, aerr := s.settings.Appearance(ctx, userID)
	if aerr != nil {
		appearance = Appearance{}
	}

	return Snapshot{
		DisplayName: displayName,
		Stars:       stars,
		Synapses:    synapses,
		Appearance:  appearance,
	}, nil
}

// ResonanceBridges returns the caller↔owner resonance bridges for the overlay (spec 37). The
// slug must resolve to an ENABLED share (else ErrNotFound — uniform, so overlay is blocked the
// instant the owner stops sharing, acceptance 3.2). Each partner-end memory id is mapped to its
// index in the SAME star ordering the public snapshot uses (ListStars → ORDER BY m.id), so the
// returned their_star_index lines up with the GetSharedUniverse array the client already holds
// (no index drift; 설계 요점). A non-party caller gets [] (the resonance read returns none), so a
// resonance is never disclosed to a third party (acceptance 2.2). The partner's memory id never
// leaves the server — only its public index does (content-zero intact, spec 35).
func (s *Service) ResonanceBridges(ctx context.Context, callerUserID, slug string) ([]ResonanceBridge, error) {
	ownerUserID, _, ok, err := s.repo.UserBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound // unknown / disabled / rotated slug — uniform (3.2)
	}

	pairs, err := s.resonance.ResonancesBetween(ctx, callerUserID, ownerUserID)
	if err != nil {
		return nil, err
	}
	if len(pairs) == 0 {
		return nil, nil // not a resonance party (or none yet) — no bridges, nothing disclosed
	}

	// Map the owner's memory id → its snapshot index. ListStars uses the SAME ORDER BY m.id as
	// the public snapshot assembly above, so these indices match the GetSharedUniverse array.
	ownerStars, err := s.repo.ListStars(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	indexByID := make(map[string]int, len(ownerStars))
	for i, st := range ownerStars {
		indexByID[st.ID] = i
	}

	bridges := make([]ResonanceBridge, 0, len(pairs))
	for _, p := range pairs {
		idx, ok := indexByID[p.TheirMemoryID]
		if !ok {
			continue // owner star not in the current snapshot (shouldn't happen) — never emit a stray index
		}
		bridges = append(bridges, ResonanceBridge{MyMemoryID: p.MyMemoryID, TheirStarIndex: idx})
	}
	return bridges, nil
}

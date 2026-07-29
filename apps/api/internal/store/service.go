package store

import (
	"context"
	"fmt"

	"github.com/cosimosi/api/internal/platform"
)

// The store reads: the whole catalog answered for one caller, what their universe wears, the
// permanent ownership append the achievement reward and the purchase both land through, and the
// withdrawal purge leg. Every policy — pricing by kind, what "owned" means, how an absent or retired
// selection resolves — lives here or in the catalog, never in a handler (§2.9#7).
//
// There is no Decorate here: applying an ornament is one transaction with its purchase, and that
// use-case composes these queries over its own transaction handle.

type ServiceDeps struct {
	Ownerships OwnershipStore
	Selections SelectionStore
	Purge      UserPurgeRepo
	// Decorate and Spend are the save's legs: the transaction runner, and the economy edge the debit
	// joins it through. A root that binds neither still serves the reads.
	Decorate DecorateRepo
	Spend    SpendGate
	// Achievements is the counter-report seam a save fires; required (the no-op for achievement-less
	// composition) so no root can save decorations with the seam silently unbound.
	Achievements AchievementRecorder
}

type Service struct {
	ownerships   OwnershipStore
	selections   SelectionStore
	purge        UserPurgeRepo
	decorate     DecorateRepo
	spend        SpendGate
	achievements AchievementRecorder
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Ownerships == nil || deps.Selections == nil || deps.Purge == nil {
		return nil, ErrStoreRequired
	}
	// Required, like every other context's recorder: a root that silently defaulted to the no-op would
	// lose this save's three counters entirely, and that is precisely the drift the boot reconciliation
	// exists to make impossible.
	if deps.Achievements == nil {
		return nil, ErrAchievementsRequired
	}
	return &Service{
		ownerships:   deps.Ownerships,
		selections:   deps.Selections,
		purge:        deps.Purge,
		decorate:     deps.Decorate,
		spend:        deps.Spend,
		achievements: deps.Achievements,
	}, nil
}

// Catalog answers EVERY row — owned and unowned alike — so the client renders one list of
// everything and reveals ownership through price alone ([P6][P7]). There is no owned-only read to
// ask for instead.
func (s *Service) Catalog(ctx context.Context, scope platform.UserScope) ([]CatalogItem, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	// The selection is read FIRST, and the order is load-bearing. These are two statements, so a
	// purchase-and-apply committing between them is visible to one and not the other; reading the
	// older fact first means the worst a race can produce is "owned, not yet worn" — never the
	// contradiction "worn but unowned", which would price a row the universe is already wearing.
	selection, err := s.Selection(ctx, scope)
	if err != nil {
		return nil, err
	}
	selected := make(map[OrnamentID]struct{}, len(selection))
	for _, entry := range selection {
		selected[entry.OrnamentID] = struct{}{}
	}
	ownerships, err := s.ownerships.ListOrnamentOwnerships(ctx, scope)
	if err != nil {
		return nil, fmt.Errorf("list ornament ownerships: %w", err)
	}
	owned := make(map[OrnamentID]struct{}, len(ownerships))
	for _, ownership := range ownerships {
		owned[ownership.OrnamentID] = struct{}{}
	}

	rows := Ornaments()
	items := make([]CatalogItem, 0, len(rows))
	for _, ornament := range rows {
		_, hasRow := owned[ornament.ID]
		_, isSelected := selected[ornament.ID]
		items = append(items, CatalogItem{
			Ornament: ornament,
			Price:    PriceOf(ornament),
			// A FREE row is owned by everyone with no ownership row ever written for it, which is how
			// each kind's default needs neither a signup grant nor a backfill ([P10]).
			Owned:    ornament.Acquisition == AcquisitionFree || hasRow,
			Selected: isSelected,
		})
	}
	return items, nil
}

// Selection answers exactly one entry per kind, always — an absent row and an unknown or retired
// stored id both resolving to that kind's default ([P10]). A client boot is therefore deterministic
// and needs no fallback of its own.
func (s *Service) Selection(ctx context.Context, scope platform.UserScope) ([]OrnamentSelection, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	stored, err := s.selections.ListOrnamentSelections(ctx, scope)
	if err != nil {
		return nil, fmt.Errorf("list ornament selections: %w", err)
	}
	byKind := make(map[OrnamentKind]OrnamentID, len(stored))
	for _, entry := range stored {
		if _, published := LookupOrnament(entry.OrnamentID); !published {
			continue
		}
		byKind[entry.Kind] = entry.OrnamentID
	}

	selections := make([]OrnamentSelection, 0, len(ornamentKinds))
	for _, kind := range ornamentKinds {
		id, applied := byKind[kind]
		if !applied {
			id, _ = DefaultOrnamentID(kind)
		}
		selections = append(selections, OrnamentSelection{Kind: kind, OrnamentID: id})
	}
	return selections, nil
}

// GrantOwnership records permanent ownership. Both legs land here — the purchase and the achievement
// reward — and the insert is ON CONFLICT DO NOTHING, so a replayed claim or a retried purchase
// grants once and an existing row is never overwritten ([P9][P11]).
//
// The path must be the one the CATALOG assigns the row, not merely a storable value: granting an
// achievement-only row as a purchase would buy something unbuyable, and granting a purchasable row as
// an achievement would write an audit trail that never happened. Checking the row rather than the
// argument is also why a purchase leg that forgets RequirePurchasable still cannot get through.
func (s *Service) GrantOwnership(
	ctx context.Context,
	scope platform.UserScope,
	ornamentID OrnamentID,
	acquiredVia OrnamentAcquisition,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	ornament, published := LookupOrnament(ornamentID)
	if !published {
		return fmt.Errorf("%w: %s", ErrUnknownOrnamentID, ornamentID)
	}
	if acquiredVia != AcquisitionPurchase && acquiredVia != AcquisitionAchievement {
		return fmt.Errorf("%w: %s", ErrAcquisitionNotGrantable, acquiredVia)
	}
	if ornament.Acquisition != acquiredVia {
		return fmt.Errorf("%w: %s is acquired by %s, not %s",
			ErrAcquisitionNotGrantable, ornamentID, ornament.Acquisition, acquiredVia)
	}
	if _, err := s.ownerships.InsertOrnamentOwnership(ctx, scope, ornamentID, acquiredVia); err != nil {
		return fmt.Errorf("insert ornament ownership: %w", err)
	}
	return nil
}

// PurgeUser deletes the withdrawing user's own ownership and selection rows, and is the only delete
// path this context has ([I1][U1]).
func (s *Service) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	if err := purgeUser(ctx, s.purge, scope); err != nil {
		return fmt.Errorf("purge user ornaments: %w", err)
	}
	return nil
}

package settings

import (
	"context"
	"regexp"

	"github.com/cosimosi/backend/internal/values"
)

// hexColor matches "#RRGGBB" (case-insensitive). The server validates the format
// only — the color choice itself is the user's (spec 30).
var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// freeItemIDs is the set of free axis items ("<axis>:<kind>") derived from the generated
// customization config (values.CustomizationFree, the single source — A11). Free kinds are
// implicitly owned by everyone; they are valid selections but never appear in user_owned_items.
var freeItemIDs = func() map[string]bool {
	m := make(map[string]bool, len(values.CustomizationFree))
	for axis, kind := range values.CustomizationFree {
		m[axis+":"+kind] = true
	}
	return m
}()

// isFree reports whether an item id is a free axis kind (implicit ownership).
func isFree(itemID string) bool { return freeItemIDs[itemID] }

// priceOf returns the price of a paid item; ok=false for an unknown/free id.
func priceOf(itemID string) (int, bool) {
	p, ok := values.CustomizationPrice[itemID]
	return p, ok
}

// isKnownItem reports whether an item id is in the catalog — a free axis kind OR a priced paid
// item. The BE whitelist is exactly (free 4-axis map) ∪ (price-map keys); the visual catalog
// (entities) defines what those ids look like, this only rejects clearly-unknown ids (A14).
func isKnownItem(itemID string) bool {
	if isFree(itemID) {
		return true
	}
	_, ok := priceOf(itemID)
	return ok
}

// isOwned reports whether the user may select an item: a free kind, or a paid item in their
// owned set. The selection-ownership rule (A4) uses this to reject locked selections.
func isOwned(itemID string, owned map[string]bool) bool {
	return isFree(itemID) || owned[itemID]
}

// Service holds the settings policy: validation + partial-update orchestration + the purchase /
// inventory economy (spec 44). Ownership/balance live in the Repository (server-authoritative).
type Service struct {
	repo Repository
}

// NewService wires the settings service over its persistence Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the user's stored visual overrides (the client merges its defaults).
func (s *Service) Get(ctx context.Context, userID string) (Settings, error) {
	return s.repo.Get(ctx, userID)
}

// Update validates the whole patch BEFORE any write (no partial application — A2/A4): every
// present axis selection must be a KNOWN item (ErrUnknownItem) AND owned-or-free (ErrNotOwned),
// and every color must be #RRGGBB. Mood validity is enforced at the handler. Only when an axis is
// present do we read the owned set (a colors-only update needs no ownership round-trip).
func (s *Service) Update(ctx context.Context, userID string, p Patch) (Settings, error) {
	sels := []struct {
		axis string
		kind *string
	}{
		{"background", p.Theme},
		{"star", p.StarObject},
		{"self", p.SelfObject},
		{"synapse", p.SynapseStyle},
	}
	// 1) Pure checks first (no DB) so an unknown item / bad color is rejected WITHOUT touching any
	//    row — a rejected patch must change nothing (A2/A4), including never seeding the wallet.
	for _, sel := range sels {
		if sel.kind != nil && !isKnownItem(sel.axis+":"+*sel.kind) {
			return Settings{}, ErrUnknownItem
		}
	}
	for _, c := range p.EmotionColors {
		if !hexColor.MatchString(c.Color) {
			return Settings{}, ErrInvalidColor
		}
	}
	// 2) Ownership check needs the owned set — read it WITHOUT seeding the wallet (ListOwned), and
	//    only when an axis is present (a colors-only update needs no ownership round-trip).
	if hasAxisSelection(p) {
		owned, err := s.ownedSet(ctx, userID)
		if err != nil {
			return Settings{}, err
		}
		for _, sel := range sels {
			if sel.kind != nil && !isOwned(sel.axis+":"+*sel.kind, owned) {
				return Settings{}, ErrNotOwned
			}
		}
	}
	if err := s.repo.Update(ctx, userID, p); err != nil {
		return Settings{}, err
	}
	return s.repo.Get(ctx, userID)
}

// GetInventory seeds the wallet on first read (starting balance) and returns balance + owned
// items (A1). Seeding is idempotent in the repository.
func (s *Service) GetInventory(ctx context.Context, userID string) (Inventory, error) {
	return s.repo.GetInventory(ctx, userID, values.CustomizationStartingStardust)
}

// PurchaseItem validates the item is a KNOWN PAID item, then delegates the atomic debit+grant to
// the repository (A2). Unknown id → ErrUnknownItem; a free kind → ErrItemFree (free is implicit,
// nothing to buy). The repository returns ErrAlreadyOwned / ErrInsufficientFunds atomically.
func (s *Service) PurchaseItem(ctx context.Context, userID, itemID string) (Inventory, error) {
	if isFree(itemID) {
		return Inventory{}, ErrItemFree
	}
	price, ok := priceOf(itemID)
	if !ok {
		return Inventory{}, ErrUnknownItem
	}
	return s.repo.Purchase(ctx, userID, itemID, price, values.CustomizationStartingStardust)
}

// ownedSet reads the user's owned paid items as a set (free kinds are not stored — they're
// implicit). Read-only: it does NOT seed the wallet (a rejected UpdateSettings changes no row).
func (s *Service) ownedSet(ctx context.Context, userID string) (map[string]bool, error) {
	ids, err := s.repo.ListOwned(ctx, userID)
	if err != nil {
		return nil, err
	}
	owned := make(map[string]bool, len(ids))
	for _, id := range ids {
		owned[id] = true
	}
	return owned, nil
}

// hasAxisSelection reports whether the patch touches any of the four selection axes.
func hasAxisSelection(p Patch) bool {
	return p.Theme != nil || p.StarObject != nil || p.SelfObject != nil || p.SynapseStyle != nil
}

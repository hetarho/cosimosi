package settings

import (
	"context"
	"regexp"
	"strings"

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

// legacyOwnedSubItems maps a pre-spec-52 paid item id to the form/surface sub-items it now grants,
// so a past purchase keeps unlocking the same skin after the form×surface split — WITHOUT a DB
// migration (ownership values are expanded on read). Frozen: these legacy ids never change (the
// catalog id is the historical purchase record). Background ids were not split, so they aren't here.
// Star is excluded: change 29 collapsed it to a single-axis look (star:look:<id>) before launch, so
// there are no legacy star purchases to preserve (no compat needed).
var legacyOwnedSubItems = map[string][]string{
	"self:prism-cube":   {"self:form:cube", "self:surface:prism"},
	"self:neuron-bloom": {"self:form:bloom", "self:surface:neuron"},
	"synapse:particle":  {"synapse:form:dotted", "synapse:surface:beads"},
	"synapse:dendrite":  {"synapse:form:branched"}, // surface flow is free
}

// expandLegacyOwned returns the owned ids plus the form/surface sub-items any legacy paid id now
// grants (deduped, order-stable). Applied on both inventory reads so a past buyer's selection
// validates and the FE shows the sub-items as owned (no double-charge on the new pickers).
func expandLegacyOwned(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	for _, id := range ids {
		add(id)
		for _, sub := range legacyOwnedSubItems[id] {
			add(sub)
		}
	}
	return out
}

// selectionSubItems resolves an axis selection to the item ids it must own. Background is single
// ("background:<kind>"); star is a single-axis look ("star:look:<kind>", change 29); self/synapse
// still serialize a composite "<form>+<surface>" into one wire field, so a selection owns TWO
// sub-items ("<axis>:form:<f>", "<axis>:surface:<s>") — both must be known + owned. A non-composite
// value on self/synapse (legacy/tampered) yields one unknown sub-item so validation rejects it (A2/A4/A9).
func selectionSubItems(axis, kind string) []string {
	if axis == "background" {
		return []string{axis + ":" + kind}
	}
	if axis == "star" {
		return []string{"star:look:" + kind}
	}
	form, surface, ok := strings.Cut(kind, "+")
	if !ok {
		return []string{axis + ":form:" + kind}
	}
	return []string{axis + ":form:" + form, axis + ":surface:" + surface}
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
	//    row — a rejected patch must change nothing (A2/A4), including never seeding the wallet. Object
	//    axes decode their composite "<form>+<surface>" into two sub-items; both must be known (spec 52).
	for _, sel := range sels {
		if sel.kind == nil {
			continue
		}
		for _, id := range selectionSubItems(sel.axis, *sel.kind) {
			if !isKnownItem(id) {
				return Settings{}, ErrUnknownItem
			}
		}
	}
	for _, c := range p.EmotionColors {
		if !hexColor.MatchString(c.Color) {
			return Settings{}, ErrInvalidColor
		}
	}
	// Per-emotion form override (change 30): each look must be a KNOWN star look item — same
	// "star:look:<id>" id-space the global star axis uses, so ownership is one rule for both.
	for _, ef := range p.EmotionForms {
		for _, id := range selectionSubItems("star", ef.Look) {
			if !isKnownItem(id) {
				return Settings{}, ErrUnknownItem
			}
		}
	}
	// 2) Ownership check needs the owned set — read it WITHOUT seeding the wallet (ListOwned), and
	//    only when a selection is present (a colors-only update needs no ownership round-trip; an
	//    emotion-form override assigns a look so it needs one — A4).
	if hasAxisSelection(p) || len(p.EmotionForms) > 0 {
		owned, err := s.ownedSet(ctx, userID)
		if err != nil {
			return Settings{}, err
		}
		for _, sel := range sels {
			if sel.kind == nil {
				continue
			}
			// 합성 선택의 소유 = 양쪽 sub-item 소유(또는 무료) — 한쪽이라도 미소유면 거부(A5).
			for _, id := range selectionSubItems(sel.axis, *sel.kind) {
				if !isOwned(id, owned) {
					return Settings{}, ErrNotOwned
				}
			}
		}
		// 감정별 형태 오버라이드도 룩을 *배정*하므로 소유(또는 무료)여야 한다 — 미소유면 거부(change 30, A4).
		for _, ef := range p.EmotionForms {
			for _, id := range selectionSubItems("star", ef.Look) {
				if !isOwned(id, owned) {
					return Settings{}, ErrNotOwned
				}
			}
		}
	}
	if err := s.repo.Update(ctx, userID, p); err != nil {
		return Settings{}, err
	}
	return s.repo.Get(ctx, userID)
}

// GetInventory seeds the wallet on first read (starting balance) and returns balance + owned
// items (A1). Owned ids are expanded so a legacy paid purchase reports the form/surface sub-items it
// now grants (spec 52 — the FE pickers show them as owned, no double-charge). Seeding is idempotent.
func (s *Service) GetInventory(ctx context.Context, userID string) (Inventory, error) {
	inv, err := s.repo.GetInventory(ctx, userID, values.CustomizationStartingStardust)
	if err != nil {
		return Inventory{}, err
	}
	inv.OwnedItemIDs = expandLegacyOwned(inv.OwnedItemIDs)
	return inv, nil
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
	// Expand legacy paid ids → their form/surface sub-items so a past purchase still satisfies the
	// composite ownership check (spec 52). Mirrors GetInventory so FE and validation agree.
	expanded := expandLegacyOwned(ids)
	owned := make(map[string]bool, len(expanded))
	for _, id := range expanded {
		owned[id] = true
	}
	return owned, nil
}

// hasAxisSelection reports whether the patch touches any of the four selection axes.
func hasAxisSelection(p Patch) bool {
	return p.Theme != nil || p.StarObject != nil || p.SelfObject != nil || p.SynapseStyle != nil
}

package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

// The save ([P8]): buy the unowned members of a selection and apply the whole selection, in one
// transaction. A failure anywhere leaves no ownership row, no applied row and no ledger row — the
// user is refused, never half-charged.
//
// Two things about the shape are load-bearing:
//
//   - **The charge is derived from what was actually acquired**, never from what the caller says it is
//     buying. The request carries no amount at all, and the total is summed over the inserts that
//     reported acquiring a row. A pre-read of ownership followed by an insert would double-charge two
//     concurrent identical saves; the primary key is what serializes them, so the answer comes from
//     the insert itself.
//   - **The selection is a full-state write, not a patch.** Every kind arrives every time, so a
//     half-applied selection is unrepresentable and the panel's revert-to-confirmed model has
//     something exact to revert to.

// Selection is a complete decoration state: one entry per kind, where an absent or empty id means
// that kind's free default. Absence is the single representation of a default, in this type and in
// the table alike.
type Selection map[OrnamentKind]OrnamentID

// The achievement counter facts a save reports. Their spelling and their accumulate/reach mode belong
// to the achievement catalog; this context only emits them, through a port whose payload is a key and
// a delta.
const (
	// CounterDecorationSaved counts saves that changed something — the "first time you decorated"
	// fact. A save that changes nothing records nothing, so re-saving cannot farm it.
	CounterDecorationSaved = "decoration_saved"
	// CounterOrnamentOwned is a reach counter: how many ornaments the user owns after this save.
	CounterOrnamentOwned = "ornament_owned"
	// counterOrnamentKindDecoratedPrefix + KIND counts a kind whose applied id actually changed. The
	// member is built from the enum, never from input, so no caller can invent a counter key.
	counterOrnamentKindDecoratedPrefix = "ornament_kind_decorated:"
)

func CounterOrnamentKindDecorated(kind OrnamentKind) string {
	return counterOrnamentKindDecoratedPrefix + string(kind)
}

// AchievementCounterKeys is every key this context can emit, the kind family expanded. The
// composition root reconciles it against the keys the achievement catalog reads and refuses to boot
// on a difference — the only check that can catch a rename, since a producing context cannot import
// the catalog's constants.
func AchievementCounterKeys() []string {
	keys := []string{CounterDecorationSaved, CounterOrnamentOwned}
	for _, kind := range AllOrnamentKinds() {
		keys = append(keys, CounterOrnamentKindDecorated(kind))
	}
	return keys
}

// InsufficientTwinkle is the save's refusal, carrying the numbers the economy computed plus the one
// thing only the catalog knows: which item the balance ran out on. `store` never recomputes a
// shortfall — the composition-root adapter forwards the economy's own.
type InsufficientTwinkle struct {
	Cost       int
	Eligible   int
	Shortfall  int
	OrnamentID OrnamentID
}

func (e *InsufficientTwinkle) Error() string {
	if e.Shortfall == 0 {
		return fmt.Sprintf("%s: %d needed", ErrInsufficientTwinkle.Error(), e.Cost)
	}
	return fmt.Sprintf("%s: %s costs more than the %d available (short %d)",
		ErrInsufficientTwinkle.Error(), e.OrnamentID, e.Eligible, e.Shortfall)
}

func (e *InsufficientTwinkle) Unwrap() error { return ErrInsufficientTwinkle }

// Detail is the denial as the shipped apperr metadata channel carries it. The panel resolves the id
// to a name and points at the row; this only names it.
func (e *InsufficientTwinkle) Detail() map[string]string {
	detail := map[string]string{"cost": strconv.Itoa(e.Cost)}
	// A shortfall of zero is never a real refusal, so it marks the case where the economy refused
	// without its arithmetic: the numbers it did not supply are omitted rather than reported as 0.
	if e.Shortfall > 0 {
		detail["eligible"] = strconv.Itoa(e.Eligible)
		detail["shortfall"] = strconv.Itoa(e.Shortfall)
	}
	if e.OrnamentID != "" {
		detail["ornament_id"] = string(e.OrnamentID)
	}
	return detail
}

// Decorate buys and applies one selection. It returns the confirmed selection — the same shape the
// selection read answers, so a client renders one selection type — and what this save charged (0 for
// a free re-select, which is a successful no-op).
func (s *Service) Decorate(
	ctx context.Context,
	scope platform.UserScope,
	requested Selection,
) ([]OrnamentSelection, int, error) {
	if scope.UserID() == "" {
		return nil, 0, ErrScopeRequired
	}
	if s.decorate == nil || s.spend == nil {
		return nil, 0, ErrStoreRequired
	}
	// Validated before the transaction opens: an id nobody publishes, or an id whose kind is not the
	// one it arrived under, is a caller fault and must not reach a write.
	wanted, err := resolveRequest(requested)
	if err != nil {
		return nil, 0, err
	}

	var applied []OrnamentSelection
	charged := 0
	err = s.decorate.InDecorateTx(ctx, func(tx DecorateTx) error {
		owned, err := tx.ListOrnamentOwnerships(ctx, scope)
		if err != nil {
			return fmt.Errorf("list ornament ownerships: %w", err)
		}
		ownedIDs := make(map[OrnamentID]struct{}, len(owned))
		for _, ownership := range owned {
			ownedIDs[ownership.OrnamentID] = struct{}{}
		}

		acquired, err := acquireUnowned(ctx, tx, scope, wanted, ownedIDs)
		if err != nil {
			return err
		}
		charged = chargeTotal(acquired)
		if charged > 0 {
			spend := PurchaseSpend{Amount: charged, DedupKey: purchaseDedupKey(acquired)}
			if err := s.spend.CheckAndSpend(ctx, scope, tx, spend); err != nil {
				return blameShortItem(err, acquired)
			}
		}

		stored, err := tx.ListOrnamentSelections(ctx, scope)
		if err != nil {
			return fmt.Errorf("list ornament selections: %w", err)
		}
		changedKinds, err := applySelection(ctx, tx, scope, wanted, stored)
		if err != nil {
			return err
		}
		if err := s.record(ctx, scope, tx, changedKinds, len(ownedIDs)+len(acquired)); err != nil {
			return err
		}
		applied = confirmedSelection(wanted)
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return applied, charged, nil
}

// resolveRequest turns a submitted selection into the per-kind ornament this save means, in the one
// order every kind-wise step walks.
//
// A kind's DEFAULT id normalizes to empty, and that is not a convenience: absence is the single
// representation of a default, so a save that names the default explicitly must land as no row rather
// than as a second way to say the same thing. It also closes the only way an unchanged save could look
// changed — alternating the default id and an empty one would otherwise report progress each time.
func resolveRequest(requested Selection) ([]Ornament, error) {
	wanted := make([]Ornament, 0, len(ornamentKinds))
	for _, kind := range ornamentKinds {
		id := requested[kind]
		if fallback, ok := DefaultOrnamentID(kind); ok && id == fallback {
			id = ""
		}
		if id == "" {
			wanted = append(wanted, Ornament{Kind: kind})
			continue
		}
		ornament, published := LookupOrnament(id)
		if !published {
			return nil, fmt.Errorf("%w: %s", ErrUnknownOrnamentID, id)
		}
		if ornament.Kind != kind {
			return nil, fmt.Errorf("%w: %s is not a %s ornament", ErrUnknownOrnamentID, id, kind)
		}
		wanted = append(wanted, ornament)
	}
	return wanted, nil
}

// acquireUnowned buys what the save needs and does not have. An unowned achievement-only row is
// refused here rather than priced: it is not expensive, it is not for sale ([P11]).
func acquireUnowned(
	ctx context.Context,
	tx DecorateTx,
	scope platform.UserScope,
	wanted []Ornament,
	ownedIDs map[OrnamentID]struct{},
) ([]Ornament, error) {
	acquired := make([]Ornament, 0, len(wanted))
	for _, ornament := range wanted {
		if ornament.ID == "" || ornament.Acquisition == AcquisitionFree {
			continue
		}
		if _, has := ownedIDs[ornament.ID]; has {
			continue
		}
		if ornament.Acquisition != AcquisitionPurchase {
			return nil, fmt.Errorf("%w: %s", ErrOrnamentNotPurchasable, ornament.ID)
		}
		// The affected-row count, not a preceding read, is what says this save acquired the row.
		gained, err := tx.InsertOrnamentOwnership(ctx, scope, ornament.ID, AcquisitionPurchase)
		if err != nil {
			return nil, fmt.Errorf("insert ornament ownership: %w", err)
		}
		if gained {
			acquired = append(acquired, ornament)
		}
	}
	return acquired, nil
}

func chargeTotal(acquired []Ornament) int {
	total := 0
	for _, ornament := range acquired {
		total += PriceOf(ornament)
	}
	return total
}

// purchaseDedupKey keys the debit by the set this save acquired. Single-use by construction:
// ownership is permanent and never refunded, so the same set cannot be acquired twice — a retry folds
// onto the same key, and a later purchase of something else hashes differently.
func purchaseDedupKey(acquired []Ornament) string {
	ids := make([]string, 0, len(acquired))
	for _, ornament := range acquired {
		ids = append(ids, string(ornament.ID))
	}
	slices.Sort(ids)
	var payload strings.Builder
	for _, id := range ids {
		// Length-prefixed so "ab"+"c" and "a"+"bc" cannot hash alike.
		fmt.Fprintf(&payload, "%d:%s", len(id), id)
	}
	digest := sha256.Sum256([]byte(payload.String()))
	return "ornament_purchase:" + hex.EncodeToString(digest[:])
}

// blameShortItem names the item the balance ran out on: fill the acquired set cheapest-first against
// what the economy said was available, and the first row that does not fit is the one to point at.
// Deterministic, and with at most one purchasable row per kind it is in practice the single item the
// user cannot afford. A refusal detail, so the ordering lives here and is mirrored nowhere.
func blameShortItem(err error, acquired []Ornament) error {
	var insufficient *InsufficientTwinkle
	if !asInsufficient(err, &insufficient) {
		if !isInsufficient(err) {
			return err
		}
		// The economy can also refuse without its arithmetic — a raced balance caught by the ledger's own
		// guard. The save still knows what it was asking for, so the total travels even when the
		// shortfall cannot; naming an item would be guessing, so it stays unnamed.
		return &InsufficientTwinkle{Cost: chargeTotal(acquired)}
	}
	ordered := slices.Clone(acquired)
	slices.SortFunc(ordered, func(left, right Ornament) int {
		if delta := PriceOf(left) - PriceOf(right); delta != 0 {
			return delta
		}
		return strings.Compare(string(left.ID), string(right.ID))
	})
	remaining := insufficient.Eligible
	for _, ornament := range ordered {
		price := PriceOf(ornament)
		if price > remaining {
			insufficient.OrnamentID = ornament.ID
			break
		}
		remaining -= price
	}
	return insufficient
}

// applySelection writes what the universe now wears and answers which kinds actually moved. Reverting
// a kind to its default deletes the row, so absence stays the single representation of a default.
func applySelection(
	ctx context.Context,
	tx DecorateTx,
	scope platform.UserScope,
	wanted []Ornament,
	stored []OrnamentSelection,
) ([]OrnamentKind, error) {
	current := make(map[OrnamentKind]OrnamentID, len(stored))
	for _, entry := range stored {
		current[entry.Kind] = entry.OrnamentID
	}
	changed := make([]OrnamentKind, 0, len(wanted))
	for _, ornament := range wanted {
		if current[ornament.Kind] == ornament.ID {
			continue
		}
		if ornament.ID == "" {
			if err := tx.DeleteOrnamentSelection(ctx, scope, ornament.Kind); err != nil {
				return nil, fmt.Errorf("delete ornament selection: %w", err)
			}
		} else {
			selection := OrnamentSelection{Kind: ornament.Kind, OrnamentID: ornament.ID}
			if err := tx.UpsertOrnamentSelection(ctx, scope, selection); err != nil {
				return nil, fmt.Errorf("upsert ornament selection: %w", err)
			}
		}
		changed = append(changed, ornament.Kind)
	}
	return changed, nil
}

// record reports the save's counter facts inside the transaction. A save that changed nothing reports
// nothing at all — there is no fact in it.
//
// `ownedAfter` is this transaction's own view: the ownership list it read plus what its insert
// acquired. Two saves committing concurrently from the same starting snapshot therefore both report
// the smaller total, and the counter LAGS the table by one until the next save. That is left alone
// deliberately: the counter is a high-water mark, so a lag can only delay an achievement by one save
// and can never overstate ownership, and closing it would mean serializing every decoration save
// behind an advisory lock for the sake of a count. A future reader tempted to re-read the list here
// should note that a re-read inside a READ COMMITTED transaction still cannot see the other save's
// uncommitted insert, so it would fix nothing.
//
// That concurrent-save lag is the ONLY one: the other ownership leg, an achievement grant, reports the
// total for itself inside its own transaction, so it never waits for a save that may never come.
func (s *Service) record(
	ctx context.Context,
	scope platform.UserScope,
	tx EconomyTx,
	changedKinds []OrnamentKind,
	ownedAfter int,
) error {
	if len(changedKinds) == 0 {
		return nil
	}
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterDecorationSaved, 1); err != nil {
		return fmt.Errorf("record decoration saved: %w", err)
	}
	if err := s.recordOwnershipTotal(ctx, scope, tx, ownedAfter); err != nil {
		return err
	}
	for _, kind := range changedKinds {
		key := CounterOrnamentKindDecorated(kind)
		if err := s.achievements.RecordProgress(ctx, scope, tx, key, 1); err != nil {
			return fmt.Errorf("record %s: %w", key, err)
		}
	}
	return nil
}

// confirmedSelection is what the save committed, resolved the same way the selection read resolves it:
// one entry per kind, an empty id reading as that kind's default.
func confirmedSelection(wanted []Ornament) []OrnamentSelection {
	applied := make([]OrnamentSelection, 0, len(wanted))
	for _, ornament := range wanted {
		id := ornament.ID
		if id == "" {
			id, _ = DefaultOrnamentID(ornament.Kind)
		}
		applied = append(applied, OrnamentSelection{Kind: ornament.Kind, OrnamentID: id})
	}
	return applied
}

// recordOwnershipTotal is the one ownership report both acquisition legs make. It is a REACH value —
// the count after this transaction's insert, not a delta — so reporting the same total twice is a
// no-op and an extra report can only ever be correct. Shared rather than duplicated because the two
// legs must agree on what the counter means: a delta from one and a total from the other would make
// the tiers unreachable or reachable twice over.
func (s *Service) recordOwnershipTotal(
	ctx context.Context,
	scope platform.UserScope,
	tx EconomyTx,
	ownedAfter int,
) error {
	if err := s.achievements.RecordProgress(ctx, scope, tx, CounterOrnamentOwned, ownedAfter); err != nil {
		return fmt.Errorf("record ornament owned: %w", err)
	}
	return nil
}

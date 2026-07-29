package store

import "errors"

var (
	// ErrScopeRequired mirrors the transport guard: every read and every grant is scoped to an
	// authenticated user ([U1]).
	ErrScopeRequired = errors.New("store requires an authenticated user scope")
	// ErrStoreRequired is a wiring fault — the service was built without the repository it reads.
	ErrStoreRequired = errors.New("store service requires its ornament repositories")
	// ErrAchievementsRequired is a wiring fault — the service was built without the counter-report
	// seam a save fires.
	ErrAchievementsRequired = errors.New("store service requires an achievement recorder")
	// ErrUnknownOrnamentID refuses an id the catalog does not publish: a typo, a retired row, or an
	// id a client invented. Note the asymmetry with a READ, where an unknown stored id coerces to the
	// kind's default: a read must always answer, a write must never guess.
	ErrUnknownOrnamentID = errors.New("store does not publish this ornament id")
	// ErrOrnamentNotPurchasable is the catalog's refusal of a buy attempt on a row that is not for
	// sale — an ACHIEVEMENT row at any price, or a FREE row that is already owned ([P11]).
	ErrOrnamentNotPurchasable = errors.New("this ornament is not purchasable")
	// ErrAcquisitionNotGrantable refuses an ownership row for the one acquisition path that has no
	// row: FREE is owned by everyone through the ABSENCE of a row, so writing one would invent a
	// second encoding of the same fact ([P10]).
	ErrAcquisitionNotGrantable = errors.New("store ownership can only be acquired by purchase or achievement")
	// ErrInsufficientTwinkle is the whole save refused ([P8]): nothing bought, nothing applied. The
	// typed InsufficientTwinkle carries the numbers and the item; this is what callers match on.
	ErrInsufficientTwinkle = errors.New("not enough twinkle to save this decoration")
)

// asInsufficient / isInsufficient are errors.As / errors.Is for the save's refusal, kept here so the
// use-case reads as prose.
func asInsufficient(err error, target **InsufficientTwinkle) bool {
	return errors.As(err, target)
}

func isInsufficient(err error) bool {
	return errors.Is(err, ErrInsufficientTwinkle)
}

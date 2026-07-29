package store

import "errors"

var (
	// ErrScopeRequired mirrors the transport guard: every read and every grant is scoped to an
	// authenticated user ([U1]).
	ErrScopeRequired = errors.New("store requires an authenticated user scope")
	// ErrStoreRequired is a wiring fault — the service was built without the repository it reads.
	ErrStoreRequired = errors.New("store service requires its ornament repositories")
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
)

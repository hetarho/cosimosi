package entry

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned when a requested entry does not exist.
var ErrNotFound = errors.New("entry: not found")

// Repository is the persistence port for the entry feature.
//
// It is declared in this file (at the consumer) rather than in the
// implementation file, which is the idiomatic Go placement —
// the consumer defines the contract it needs, the implementation
// satisfies it implicitly.
type Repository interface {
	Create(ctx context.Context, e Entry) (Entry, error)
	GetByDate(ctx context.Context, date time.Time) (Entry, error)
	List(ctx context.Context, limit, offset int) ([]Entry, error)
	Update(ctx context.Context, e Entry) (Entry, error)
	Delete(ctx context.Context, id string) error
}

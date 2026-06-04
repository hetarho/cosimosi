package link

import (
	"context"

	"github.com/cosimosi/backend/internal/memory"
)

// Repository is the read-only persistence port for the synapse graph (the pgx
// implementation is in repository_pg.go). Scoped to one user (memory_links.user_id).
type Repository interface {
	// ListByUser returns every synapse for the user — dormant ones included, no
	// weight filter (constitution §2).
	ListByUser(ctx context.Context, userID string) ([]memory.Synapse, error)
}

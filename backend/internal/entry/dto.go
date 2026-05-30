package entry

import (
	"encoding/json"
	"time"
)

// HTTP-shaped request/response types live here.
// They carry JSON tags and validation tags; the domain Entry stays clean.
// Mapping between DTO and domain happens at the handler boundary.

type createRequest struct {
	Date    string          `json:"date"    validate:"required"` // YYYY-MM-DD
	Mood    Mood            `json:"mood"    validate:"required"`
	Note    string          `json:"note"`
	Artwork json.RawMessage `json:"artwork"`
}

type entryResponse struct {
	ID        string          `json:"id"`
	Date      string          `json:"date"`
	Mood      Mood            `json:"mood"`
	Note      string          `json:"note"`
	Artwork   json.RawMessage `json:"artwork"`
	ThumbKey  string          `json:"thumbKey,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

func toResponse(e Entry) entryResponse {
	return entryResponse{
		ID:        e.ID,
		Date:      e.Date.Format("2006-01-02"),
		Mood:      e.Mood,
		Note:      e.Note,
		Artwork:   e.Artwork,
		ThumbKey:  e.ThumbKey,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

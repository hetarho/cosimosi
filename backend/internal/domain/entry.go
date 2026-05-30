package domain

import "time"

type Mood string

const (
	MoodCalm       Mood = "calm"
	MoodJoy        Mood = "joy"
	MoodStorm      Mood = "storm"
	MoodMelancholy Mood = "melancholy"
	MoodWonder     Mood = "wonder"
)

type Entry struct {
	ID          string         `json:"id"`
	EntryDate   time.Time      `json:"entryDate"`
	Mood        Mood           `json:"mood"`
	Note        string         `json:"note"`
	ArtworkSpec map[string]any `json:"artworkSpec"`
	ThumbKey    string         `json:"thumbKey,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

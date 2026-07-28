package account

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

func TestMoodColorGoldenParity(t *testing.T) {
	t.Parallel()
	data, err := os.ReadFile("testdata/mood-color-parity.json")
	if err != nil {
		t.Fatalf("read parity fixture: %v", err)
	}
	var cases []struct {
		Input   Color `json:"input"`
		Snapped Color `json:"snapped"`
		Bucket  int32 `json:"bucket"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatalf("decode parity fixture: %v", err)
	}
	for _, testCase := range cases {
		got, err := SnapToEmotionStep(testCase.Input)
		if err != nil {
			t.Fatalf("SnapToEmotionStep(%s): %v", testCase.Input, err)
		}
		if got != testCase.Snapped || HueBucket(got) != testCase.Bucket {
			t.Fatalf(
				"SnapToEmotionStep(%s) = %s bucket %d, want %s bucket %d",
				testCase.Input,
				got,
				HueBucket(got),
				testCase.Snapped,
				testCase.Bucket,
			)
		}
	}
}

func TestSetMoodColorValidatesSnapsAndStoresPerMood(t *testing.T) {
	t.Parallel()
	store := &fakeStore{profiles: map[string]Profile{"u1": provisionedProfile("u1")}}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	got, err := service.SetMoodColor(context.Background(), scope, MoodJoy, "#bb44aa")
	if err != nil {
		t.Fatalf("SetMoodColor: %v", err)
	}
	if got != (MoodColor{Mood: MoodJoy, Color: "#ca53b8"}) {
		t.Fatalf("SetMoodColor = %+v", got)
	}
	rows, err := service.GetMoodColors(context.Background(), scope)
	if err != nil || len(rows) != 1 || rows[0] != got {
		t.Fatalf("GetMoodColors = %+v, %v", rows, err)
	}
	if _, err := service.SetMoodColor(context.Background(), scope, Mood("UNKNOWN"), "#bb44aa"); !errors.Is(err, ErrMoodInvalid) {
		t.Fatalf("unknown mood err = %v", err)
	}
	if _, err := service.SetMoodColor(context.Background(), scope, MoodCalm, "#BADA55"); !errors.Is(err, ErrColorInvalid) {
		t.Fatalf("invalid color err = %v", err)
	}
	if _, err := service.SetMoodColor(context.Background(), scope, MoodCalm, "#0000ff"); !errors.Is(err, ErrColorInvalid) {
		t.Fatalf("out-of-gamut snapped color err = %v", err)
	}
}

func TestMoodColorStatsOmitSharesBelowFloor(t *testing.T) {
	t.Parallel()
	store := &fakeStore{
		profiles: map[string]Profile{"u1": provisionedProfile("u1")},
		moodColorStats: map[Mood][]MoodColorStatCount{
			MoodJoy: {
				{
					Bucket:      1,
					BucketCount: int64(values.PaletteStatMinSample),
					TotalCount:  int64(values.PaletteStatMinSample) + 1,
					SwatchColor: "#ca53b8",
				},
				{
					Bucket:      2,
					BucketCount: int64(values.PaletteStatMinSample) - 1,
					TotalCount:  int64(values.PaletteStatMinSample) + 1,
					SwatchColor: "#e6b731",
				},
			},
		},
	}
	service := newTestService(t, store)

	stats, err := service.GetMoodColorStats(context.Background(), mustScope(t, "u1"), MoodJoy)
	if err != nil {
		t.Fatalf("GetMoodColorStats: %v", err)
	}
	if len(stats) != 2 || stats[0].Share == nil || stats[1].Share != nil {
		t.Fatalf("stats share floor = %+v", stats)
	}
}

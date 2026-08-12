package account

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
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

func TestMoodColorStatsShareEveryBucketIncludingASingleChoice(t *testing.T) {
	t.Parallel()
	store := &fakeStore{
		profiles: map[string]Profile{"u1": provisionedProfile("u1")},
		moodColorStats: map[Mood][]MoodColorStatCount{
			// One lone choice: its bucket holds every choice there is.
			MoodJoy: {{Bucket: 1, BucketCount: 1, TotalCount: 1, SwatchColor: "#ca53b8"}},
			// Three choices split two ways. The store's order is the answer — the service ranks
			// nothing, so an equal pair stays in the order the aggregate handed over.
			MoodCalm: {
				{Bucket: 4, BucketCount: 1, TotalCount: 3, SwatchColor: "#4eb9ad"},
				{Bucket: 6, BucketCount: 2, TotalCount: 3, SwatchColor: "#5eb093"},
			},
		},
	}
	service := newTestService(t, store)

	lone, err := service.GetMoodColorStats(context.Background(), mustScope(t, "u1"), MoodJoy)
	if err != nil {
		t.Fatalf("GetMoodColorStats(JOY): %v", err)
	}
	if len(lone) != 1 || lone[0].Share != 1 {
		t.Fatalf("single-choice share = %+v, want one bucket at 1", lone)
	}

	split, err := service.GetMoodColorStats(context.Background(), mustScope(t, "u1"), MoodCalm)
	if err != nil {
		t.Fatalf("GetMoodColorStats(CALM): %v", err)
	}
	if len(split) != 2 || split[0].Bucket != 4 || split[1].Bucket != 6 {
		t.Fatalf("store order = %+v, want it preserved", split)
	}
	if split[0].Share != 1.0/3.0 || split[1].Share != 2.0/3.0 {
		t.Fatalf("split shares = %+v", split)
	}
}

package memory

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestReceiptCodecReadsFrozenLegacyAndVersionedResponses(t *testing.T) {
	current := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		name   string
		legacy string
		value  any
		fresh  func() any
	}{
		{"recall", `{"Reconsolidated":true,"CurrentText":"retained scene","Seed":9007199254740993,"RecallCount":2,"EffectiveStrength":0.75,"Sync":{"Previous":null,"Current":"2026-07-15T00:00:00Z"}}`, RecallResult{true, "retained scene", 9007199254740993, 2, 0.75, SyncResult{nil, current}}, func() any { return &RecallResult{} }},
		{"diary", `{"DiaryID":"diary-a","EpisodicMemoryIDs":["m1","m2"],"Sync":{"Previous":null,"Current":"2026-07-15T00:00:00Z"}}`, RecallDiaryStarsResult{"diary-a", []string{"m1", "m2"}, SyncResult{nil, current}}, func() any { return &RecallDiaryStarsResult{} }},
		{"view", `{"Text":"the original gist","ReachedStage":2}`, ViewSemanticResult{"the original gist", 2}, func() any { return &ViewSemanticResult{} }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out := c.fresh()
			if err := decodeReceiptResponse([]byte(c.legacy), out); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(reflect.ValueOf(out).Elem().Interface(), c.value) {
				t.Fatalf("legacy result = %+v", out)
			}
			encoded, err := encodeReceiptResponse(c.value)
			if err != nil {
				t.Fatal(err)
			}
			out = c.fresh()
			if err := decodeReceiptResponse(encoded, out); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(reflect.ValueOf(out).Elem().Interface(), c.value) {
				t.Fatalf("versioned result = %+v", out)
			}
			oldReader := c.fresh()
			if err := json.Unmarshal(encoded, oldReader); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(reflect.ValueOf(oldReader).Elem().Interface(), c.value) {
				t.Fatalf("old reader cannot replay rolling-deploy receipt: %+v", oldReader)
			}
		})
	}
}

func TestReceiptCodecRejectsUnreadableCommittedResponse(t *testing.T) {
	for _, input := range []string{`{}`, `null`, `{`, `{"version":99,"kind":"view_semantic","result":{}}`, `{"version":1,"kind":"recall","result":{"text":"wrong kind","reached_stage":1}}`, `{"version":1,"kind":"view_semantic","result":null}`} {
		var out ViewSemanticResult
		if err := decodeReceiptResponse([]byte(input), &out); !errors.Is(err, ErrReceiptFormat) {
			t.Fatalf("input %s accepted: %v", input, err)
		}
	}
}

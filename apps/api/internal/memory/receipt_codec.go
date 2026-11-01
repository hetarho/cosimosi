package memory

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var ErrReceiptFormat = errors.New("unsupported or invalid paid-action receipt")

// Persisted DTOs own the durable format; application result fields may evolve independently.
type receiptEnvelope struct {
	Version int             `json:"version"`
	Kind    PaidActionKind  `json:"kind"`
	Result  json.RawMessage `json:"result"`
}
type receiptSync struct {
	Previous *time.Time `json:"previous"`
	Current  time.Time  `json:"current"`
}
type recallReceipt struct {
	Reconsolidated    bool        `json:"reconsolidated"`
	CurrentText       string      `json:"current_text"`
	Seed              int64       `json:"seed"`
	RecallCount       int32       `json:"recall_count"`
	EffectiveStrength float64     `json:"effective_strength"`
	Sync              receiptSync `json:"sync"`
}
type diaryRecallReceipt struct {
	DiaryID   string      `json:"diary_id"`
	MemoryIDs []string    `json:"memory_ids"`
	Sync      receiptSync `json:"sync"`
}
type semanticViewReceipt struct {
	Text         string `json:"text"`
	ReachedStage int16  `json:"reached_stage"`
}

// These closed DTOs retain the original unversioned keys, including nested keys.
type legacySyncReceipt struct {
	Previous *time.Time `json:"Previous"`
	Current  time.Time  `json:"Current"`
}
type legacyRecallReceipt struct {
	Reconsolidated    bool              `json:"Reconsolidated"`
	CurrentText       string            `json:"CurrentText"`
	Seed              int64             `json:"Seed"`
	RecallCount       int32             `json:"RecallCount"`
	EffectiveStrength float64           `json:"EffectiveStrength"`
	Sync              legacySyncReceipt `json:"Sync"`
}
type legacyDiaryRecallReceipt struct {
	DiaryID   string            `json:"DiaryID"`
	MemoryIDs []string          `json:"EpisodicMemoryIDs"`
	Sync      legacySyncReceipt `json:"Sync"`
}
type legacySemanticViewReceipt struct {
	Text         string `json:"Text"`
	ReachedStage int16  `json:"ReachedStage"`
}

func encodeReceiptResponse(result any) ([]byte, error) {
	var kind PaidActionKind
	var dto any
	switch value := result.(type) {
	case RecallResult:
		kind = PaidActionRecall
		dto = recallReceipt{value.Reconsolidated, value.CurrentText, value.Seed, value.RecallCount, value.EffectiveStrength, receiptSync{value.Sync.Previous, value.Sync.Current}}
	case RecallDiaryStarsResult:
		kind = PaidActionDiaryRecall
		dto = diaryRecallReceipt{value.DiaryID, value.EpisodicMemoryIDs, receiptSync{value.Sync.Previous, value.Sync.Current}}
	case ViewSemanticResult:
		kind = PaidActionViewSemantic
		dto = semanticViewReceipt{value.Text, value.ReachedStage}
	default:
		return nil, ErrReceiptFormat
	}
	payload, err := json.Marshal(dto)
	if err != nil {
		return nil, err
	}
	envelope := receiptEnvelope{1, kind, payload}
	// Keep the old top-level keys during rolling deploys: old binaries can still
	// replay new writes, while new readers use the versioned payload.
	switch value := result.(type) {
	case RecallResult:
		return json.Marshal(struct {
			receiptEnvelope
			legacyRecallReceipt
		}{envelope, legacyRecallReceipt{value.Reconsolidated, value.CurrentText, value.Seed, value.RecallCount, value.EffectiveStrength, legacySyncReceipt{value.Sync.Previous, value.Sync.Current}}})
	case RecallDiaryStarsResult:
		return json.Marshal(struct {
			receiptEnvelope
			legacyDiaryRecallReceipt
		}{envelope, legacyDiaryRecallReceipt{value.DiaryID, value.EpisodicMemoryIDs, legacySyncReceipt{value.Sync.Previous, value.Sync.Current}}})
	case ViewSemanticResult:
		return json.Marshal(struct {
			receiptEnvelope
			legacySemanticViewReceipt
		}{envelope, legacySemanticViewReceipt{value.Text, value.ReachedStage}})
	}
	return nil, ErrReceiptFormat
}

func decodeReceiptResponse(data []byte, out any) error {
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(data, &keys); err != nil || keys == nil {
		return ErrReceiptFormat
	}
	if _, versioned := keys["version"]; !versioned {
		return decodeLegacyReceipt(data, out)
	}
	var envelope receiptEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return ErrReceiptFormat
	}
	if envelope.Version != 1 || len(envelope.Result) == 0 || bytes.Equal(envelope.Result, []byte("null")) {
		return ErrReceiptFormat
	}
	switch result := out.(type) {
	case *RecallResult:
		if envelope.Kind != PaidActionRecall {
			return ErrReceiptFormat
		}
		var dto recallReceipt
		if err := decodeReceiptDTO(envelope.Result, &dto, "reconsolidated", "current_text", "seed", "recall_count", "effective_strength", "sync"); err != nil {
			return err
		}
		*result = RecallResult{dto.Reconsolidated, dto.CurrentText, dto.Seed, dto.RecallCount, dto.EffectiveStrength, SyncResult{dto.Sync.Previous, dto.Sync.Current}}
	case *RecallDiaryStarsResult:
		if envelope.Kind != PaidActionDiaryRecall {
			return ErrReceiptFormat
		}
		var dto diaryRecallReceipt
		if err := decodeReceiptDTO(envelope.Result, &dto, "diary_id", "memory_ids", "sync"); err != nil {
			return err
		}
		*result = RecallDiaryStarsResult{dto.DiaryID, dto.MemoryIDs, SyncResult{dto.Sync.Previous, dto.Sync.Current}}
	case *ViewSemanticResult:
		if envelope.Kind != PaidActionViewSemantic {
			return ErrReceiptFormat
		}
		var dto semanticViewReceipt
		if err := decodeReceiptDTO(envelope.Result, &dto, "text", "reached_stage"); err != nil {
			return err
		}
		*result = ViewSemanticResult{dto.Text, dto.ReachedStage}
	default:
		return ErrReceiptFormat
	}
	return nil
}

func decodeLegacyReceipt(data []byte, out any) error {
	switch result := out.(type) {
	case *RecallResult:
		var dto legacyRecallReceipt
		if err := decodeReceiptDTO(data, &dto, "Reconsolidated", "CurrentText", "Seed", "RecallCount", "EffectiveStrength", "Sync"); err != nil {
			return err
		}
		*result = RecallResult{dto.Reconsolidated, dto.CurrentText, dto.Seed, dto.RecallCount, dto.EffectiveStrength, SyncResult{dto.Sync.Previous, dto.Sync.Current}}
	case *RecallDiaryStarsResult:
		var dto legacyDiaryRecallReceipt
		if err := decodeReceiptDTO(data, &dto, "DiaryID", "EpisodicMemoryIDs", "Sync"); err != nil {
			return err
		}
		*result = RecallDiaryStarsResult{dto.DiaryID, dto.MemoryIDs, SyncResult{dto.Sync.Previous, dto.Sync.Current}}
	case *ViewSemanticResult:
		var dto legacySemanticViewReceipt
		if err := decodeReceiptDTO(data, &dto, "Text", "ReachedStage"); err != nil {
			return err
		}
		*result = ViewSemanticResult{dto.Text, dto.ReachedStage}
	default:
		return ErrReceiptFormat
	}
	return nil
}

func decodeReceiptDTO(data []byte, out any, required ...string) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil || fields == nil {
		return ErrReceiptFormat
	}
	for _, name := range required {
		value, found := fields[name]
		if !found || (bytes.Equal(value, []byte("null")) && name != "memory_ids" && name != "EpisodicMemoryIDs") {
			return fmt.Errorf("%w: missing %s", ErrReceiptFormat, name)
		}
	}
	for _, names := range [][3]string{{"sync", "previous", "current"}, {"Sync", "Previous", "Current"}} {
		if raw, exists := fields[names[0]]; exists {
			var nested map[string]json.RawMessage
			if err := json.Unmarshal(raw, &nested); err != nil || nested == nil {
				return ErrReceiptFormat
			}
			if _, exists := nested[names[1]]; !exists {
				return ErrReceiptFormat
			}
			if value, exists := nested[names[2]]; !exists || bytes.Equal(value, []byte("null")) {
				return ErrReceiptFormat
			}
		}
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("%w: %v", ErrReceiptFormat, err)
	}
	return nil
}

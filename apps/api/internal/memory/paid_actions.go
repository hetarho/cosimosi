package memory

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

// Paid-action idempotency (A2/A3) — the receipt layer that makes a paid action's client retry
// safe. A client mints one operation id per intent; a paid use-case looks up a matching receipt
// (under the per-user graph lock) before doing any work, so a response-loss retry — same id, same
// canonical input — replays the original committed response WITHOUT a second spend or a second
// recall, while a different input under the same id is refused. The receipt, the Twinkle debit,
// and the effects all land in ONE transaction (A3), so a receipt exists iff its effects committed.

var (
	// ErrOperationIDRequired rejects a paid action with no client operation id (A2) — a contract
	// fault surfaced as invalid input.
	ErrOperationIDRequired = errors.New("paid action requires a client operation id")
	// ErrOperationConflict is the same-id/different-input refusal (A2): the operation id already
	// committed a DIFFERENT canonical request, so replaying its receipt would return the wrong
	// result. The client must mint a fresh id.
	ErrOperationConflict = errors.New("paid action operation id was used for a different request")
	// ErrSyncConsentRequired is the pre-spend refusal when a recall/whole-diary recall would advance
	// the universe clock but the request did not consent (A1/A5). Raised before any spend or effect,
	// so nothing is charged; the client refreshes sync-status and shows the consent modal.
	ErrSyncConsentRequired = errors.New("recall requires explicit consent to advance the universe clock")
)

// PaidActionKind names which metered action a receipt records — it matches action_kind in
// memory_paid_action_receipts and the FE session's action label.
type PaidActionKind string

const (
	PaidActionRecall       PaidActionKind = "recall"
	PaidActionDiaryRecall  PaidActionKind = "diary_recall"
	PaidActionViewSemantic PaidActionKind = "view_semantic"
)

// PaidActionReceipt is one committed paid action's idempotency record (A2/A3): the client
// operation id, the action kind + canonical request fingerprint a retry is matched against, the
// retained target it cascades with (exactly one of the two ids is set), and the original typed
// response encoded as domain JSON — proto never enters the domain (§2.4). Response is opaque to
// persistence; only the owning use-case encodes/decodes it.
type PaidActionReceipt struct {
	OperationID        string
	Kind               PaidActionKind
	RequestFingerprint string
	EpisodicMemoryID   *string
	DiaryID            *string
	Response           []byte
}

// PaidActionReceiptStore is the consumer-owned receipt port (§2.4), embedded in the paid-action
// transactions so the lookup and the commit-time write join the same transaction as the debit and
// effects. Get returns found=false for no prior commit; Insert writes the commit-time receipt
// (once, after the effects, under the graph lock). The concrete is memory/pg.
type PaidActionReceiptStore interface {
	GetPaidActionReceipt(ctx context.Context, scope platform.UserScope, operationID string) (PaidActionReceipt, bool, error)
	InsertPaidActionReceipt(ctx context.Context, scope platform.UserScope, receipt PaidActionReceipt) error
}

// replayReceipt resolves a matching receipt into its stored response, or a conflict. found=false
// means no prior commit (do the work). A found receipt of a different kind or fingerprint is
// ErrOperationConflict (A2 — same id, different input); an exact match hands back the stored
// response bytes to decode and return verbatim.
func replayReceipt(receipt PaidActionReceipt, found bool, kind PaidActionKind, fingerprint string) ([]byte, bool, error) {
	if !found {
		return nil, false, nil
	}
	if receipt.Kind != kind || receipt.RequestFingerprint != fingerprint {
		return nil, false, ErrOperationConflict
	}
	return receipt.Response, true, nil
}

// recallFingerprint / diaryRecallFingerprint / viewSemanticFingerprint canonicalize a paid
// action's request into a stable hash that pins the operation id to ITS input — the same id
// replayed with a different input is caught (ErrOperationConflict) instead of returning the wrong
// committed response.
func recallFingerprint(memoryID string, rewriteText string) string {
	return actionFingerprint(string(PaidActionRecall), memoryID, rewriteText)
}

func diaryRecallFingerprint(diaryID string) string {
	return actionFingerprint(string(PaidActionDiaryRecall), diaryID)
}

func viewSemanticFingerprint(memoryID string, stage int) string {
	return actionFingerprint(string(PaidActionViewSemantic), memoryID, strconv.Itoa(stage))
}

// actionFingerprint hashes length-prefixed parts so no field boundary is ambiguous ("ab"+"c" and
// "a"+"bc" hash differently).
func actionFingerprint(parts ...string) string {
	var b strings.Builder
	for _, part := range parts {
		b.WriteString(strconv.Itoa(len(part)))
		b.WriteByte(':')
		b.WriteString(part)
		b.WriteByte(0)
	}
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

// encodeReceiptResponse / decodeReceiptResponse serialize a use-case's typed result for the
// receipt's response column and back. Domain JSON — the receipt persists a domain value, never a
// proto message (§2.4). Kept next to the receipt so all receipt encoding lives in one place.
func encodeReceiptResponse(result any) ([]byte, error) {
	return json.Marshal(result)
}

func decodeReceiptResponse(data []byte, out any) error {
	return json.Unmarshal(data, out)
}

// writeReceipt encodes a use-case's committed result and inserts its receipt in the same
// transaction as the effects (A3). Called once, last, so a receipt is written iff the whole paid
// action commits.
func (s *Service) writeReceipt(ctx context.Context, scope platform.UserScope, store PaidActionReceiptStore, receipt PaidActionReceipt, result any) error {
	response, err := encodeReceiptResponse(result)
	if err != nil {
		return err
	}
	receipt.Response = response
	return store.InsertPaidActionReceipt(ctx, scope, receipt)
}

func stringPtr(value string) *string {
	return &value
}

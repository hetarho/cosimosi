package twinkle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/cosimosi/api/internal/platform/values"
)

// Shipped port defaults (§2.8 keyless-mock posture): deterministic, key-free
// concretes for dev/test and for the seams v1 deliberately leaves permissive. The
// production store-SDK verifier is a deferred adapter behind the same port.

// KeylessPaymentVerifier is the deterministic StorePaymentVerifier fake: it accepts
// only the known v1 pack with a non-empty receipt and grants the tuned pack amount.
// The dedup key is derived from the receipt content ALONE — a caller-controlled
// field like platform must never vary the key, or the same receipt replayed with a
// respelled platform would credit twice. A replayed receipt stays idempotent exactly
// as a store-verified transaction id would. It never talks to a store — production
// must bind the real receipt adapter instead ([G3]).
type KeylessPaymentVerifier struct{}

func (KeylessPaymentVerifier) Verify(_ context.Context, receipt PaymentReceipt) (VerifiedPayment, error) {
	if receipt.PackID != DefaultChargePackID ||
		strings.TrimSpace(receipt.Platform) == "" ||
		strings.TrimSpace(receipt.Receipt) == "" {
		return VerifiedPayment{}, fmt.Errorf("%w: unknown pack or empty receipt", ErrPaymentNotVerified)
	}
	digest := sha256.Sum256([]byte(strings.TrimSpace(receipt.Receipt)))
	return VerifiedPayment{
		Amount:   values.TwinkleChargePack,
		DedupKey: "payment:" + hex.EncodeToString(digest[:]),
	}, nil
}

// DistinctSignup is the permissive ValidSignup default ([G6]): a real, distinct
// signup — both sides exist as ids and the pair is not a self-invite. The concrete
// anti-abuse criteria replace this binding later without touching the invite earn.
func DistinctSignup(_ context.Context, inviterID string, inviteeID string) (bool, error) {
	return inviterID != "" && inviteeID != "" && inviterID != inviteeID, nil
}

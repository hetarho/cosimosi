package ai

import (
	"crypto/sha1" //nolint:gosec // content fingerprint for a visual seed, not security
	"encoding/hex"
	"hash/fnv"
	"strconv"
	"strings"
)

// SegmentSeed derives the deterministic per-fragment seed spec 21 feeds into
// star form/position generation: stableHash(diary_id ":" fragment_index ":"
// sha1(normalized_text)). Same diary + index + (normalized) text always yields
// the same seed, so a re-extraction reproduces identical stars (spec 20, 1.10).
func SegmentSeed(diaryID string, fragmentIndex int, text string) uint64 {
	sum := sha1.Sum([]byte(normalizeText(text))) //nolint:gosec // see import note
	key := diaryID + ":" + strconv.Itoa(fragmentIndex) + ":" + hex.EncodeToString(sum[:])
	h := fnv.New64a()
	_, _ = h.Write([]byte(key))
	return h.Sum64()
}

// normalizeText canonicalizes text for seeding: trim, collapse all whitespace
// runs to single spaces, lowercase — cosmetic edits don't move a star.
func normalizeText(s string) string {
	return strings.ToLower(collapseSpace(s))
}

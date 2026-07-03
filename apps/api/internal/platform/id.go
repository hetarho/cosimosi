package platform

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// NewID returns the app-wide id: 16 random bytes, hex-encoded. Request ids and
// product aggregate ids share this one shape so the format has a single owner.
func NewID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return hex.EncodeToString([]byte(time.Now().UTC().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(b[:])
}

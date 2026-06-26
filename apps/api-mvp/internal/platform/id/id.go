// Package id owns server-generated opaque identifiers.
package id

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

const defaultBytes = 16

// New returns 128 bits of crypto entropy encoded as base64url without padding.
func New() (string, error) {
	return NewN(defaultBytes)
}

// NewN returns n bytes of crypto entropy encoded as base64url without padding.
func NewN(n int) (string, error) {
	if n <= 0 {
		n = defaultBytes
	}
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

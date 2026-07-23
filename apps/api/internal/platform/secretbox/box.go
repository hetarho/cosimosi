// Package secretbox is the small at-rest secret cipher the admin console uses to store AI provider
// API keys (the admin console): AES-GCM with a key from the server-only LLM_KEY_ENCRYPTION_KEY env. It is
// platform infrastructure (no business meaning) so both the admin write path (Encrypt) and the AI
// config source's read path (Decrypt) can depend on it without either context importing the other.
// Keys are never logged and never returned across an RPC boundary — only Hint (a masked tail) is.
package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// EnvEncryptionKey holds a base64 (std) encoded 16/24/32-byte AES key (documented in .env.example).
const EnvEncryptionKey = "LLM_KEY_ENCRYPTION_KEY"

var (
	// ErrKeyLength rejects a key that is not a valid AES size.
	ErrKeyLength = errors.New("secretbox: encryption key must be 16, 24, or 32 bytes")
	// ErrCiphertext rejects a ciphertext too short to hold a nonce.
	ErrCiphertext = errors.New("secretbox: ciphertext is malformed")
	// ErrDisabled is returned by the disabled cipher when no LLM_KEY_ENCRYPTION_KEY is configured —
	// so an attempt to store a provider key fails loudly instead of persisting plaintext.
	ErrDisabled = errors.New("secretbox: encryption is not configured (set LLM_KEY_ENCRYPTION_KEY)")
)

// Box is an AES-GCM cipher. The zero value is not usable — build it with New / NewFromEnv.
type Box struct {
	aead cipher.AEAD
}

// New builds a Box from a raw AES key (16, 24, or 32 bytes).
func New(key []byte) (Box, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return Box{}, ErrKeyLength
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return Box{}, fmt.Errorf("secretbox: init GCM: %w", err)
	}
	return Box{aead: aead}, nil
}

// NewFromEnv builds a Box from LLM_KEY_ENCRYPTION_KEY (base64-std of a 16/24/32-byte key). ok is
// false when the env var is empty, so the caller can inject the disabled cipher instead.
func NewFromEnv() (Box, bool, error) {
	raw := strings.TrimSpace(os.Getenv(EnvEncryptionKey))
	if raw == "" {
		return Box{}, false, nil
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return Box{}, false, fmt.Errorf("secretbox: %s must be base64: %w", EnvEncryptionKey, err)
	}
	box, err := New(key)
	if err != nil {
		return Box{}, false, err
	}
	return box, true, nil
}

// Encrypt seals plaintext as nonce || ciphertext. Every call uses a fresh random nonce.
func (b Box) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("secretbox: nonce: %w", err)
	}
	return b.aead.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt reverses Encrypt. Used by the AI config source to build a provider client, never by the
// admin RPC (which returns only Hint).
func (b Box) Decrypt(ciphertext []byte) ([]byte, error) {
	size := b.aead.NonceSize()
	if len(ciphertext) < size {
		return nil, ErrCiphertext
	}
	nonce, body := ciphertext[:size], ciphertext[size:]
	plaintext, err := b.aead.Open(nil, nonce, body, nil)
	if err != nil {
		return nil, fmt.Errorf("secretbox: open: %w", err)
	}
	return plaintext, nil
}

// Hint is a non-reversible masked tail for display (e.g. "…wxyz") — enough for an operator to tell
// two keys apart, never enough to reconstruct one. Short secrets are fully masked.
func (b Box) Hint(plaintext string) string { return Hint(plaintext) }

// Hint is also exposed as a package function (no key needed) for callers that only mask.
func Hint(plaintext string) string {
	if len(plaintext) <= 4 {
		return "…"
	}
	return "…" + plaintext[len(plaintext)-4:]
}

// Disabled is the fail-closed cipher injected when LLM_KEY_ENCRYPTION_KEY is absent: it refuses to
// encrypt (so no plaintext key is ever stored) but still masks for display.
type Disabled struct{}

func (Disabled) Encrypt([]byte) ([]byte, error) { return nil, ErrDisabled }

// Decrypt lets Disabled also satisfy the AI config source's KeyDecrypter: with encryption off no
// key was ever stored, so a decrypt attempt is a misconfiguration and fails closed.
func (Disabled) Decrypt([]byte) ([]byte, error) { return nil, ErrDisabled }

func (Disabled) Hint(plaintext string) string { return Hint(plaintext) }

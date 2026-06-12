package admin

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

// KeyEnvName is the env var holding the master key — named in errors and the
// FE setup banner so the operator knows exactly what to set.
const KeyEnvName = "LLM_KEY_ENCRYPTION_KEY"

// cryptoVersion is the format byte prefixed to every sealed blob. A future
// master-key rotation bumps it so old/new ciphertexts coexist during
// re-encryption (the rotation script itself is out of scope — spec 34 비목표).
const cryptoVersion byte = 0x01

// ErrEncryptionKeyMissing rejects key writes when the master key is not
// configured (acceptance 1.3 — the handler maps it to FailedPrecondition).
var ErrEncryptionKeyMissing = fmt.Errorf("admin: %s is not set — generate one with `openssl rand -base64 32`", KeyEnvName)

// Cipher is the AES-256-GCM envelope around stored provider API keys
// (spec 34): the DB holds only ciphertext, the master key lives only in the
// server env, so a DB dump alone cannot recover any key.
type Cipher struct {
	aead cipher.AEAD
}

// NewCipher builds the envelope cipher from the base64-encoded 32-byte master
// key. An empty value returns (nil, nil) — a valid "encryption not configured"
// state: reads still work (key_set/last4 need no decryption) and writes are
// rejected with ErrEncryptionKeyMissing by the service.
func NewCipher(base64Key string) (*Cipher, error) {
	if base64Key == "" {
		return nil, nil
	}
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("admin: %s is not valid base64: %w", KeyEnvName, err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("admin: %s must decode to 32 bytes (AES-256), got %d", KeyEnvName, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("admin: init AES: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("admin: init GCM: %w", err)
	}
	return &Cipher{aead: aead}, nil
}

// Seal encrypts a plaintext API key into the stored blob format:
// version(1B) ‖ nonce(12B) ‖ ciphertext+tag. AAD = provider name, so a blob
// copied onto another provider's row fails to decrypt (row-swap protection,
// acceptance 1.4).
func (c *Cipher) Seal(provider string, plaintext []byte) ([]byte, error) {
	if c == nil {
		return nil, ErrEncryptionKeyMissing
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("admin: nonce: %w", err)
	}
	blob := make([]byte, 0, 1+len(nonce)+len(plaintext)+c.aead.Overhead())
	blob = append(blob, cryptoVersion)
	blob = append(blob, nonce...)
	return c.aead.Seal(blob, nonce, plaintext, []byte(provider)), nil
}

// Open decrypts a stored blob back to the plaintext key, verifying the
// version byte and the provider AAD.
func (c *Cipher) Open(provider string, blob []byte) ([]byte, error) {
	if c == nil {
		return nil, ErrEncryptionKeyMissing
	}
	ns := c.aead.NonceSize()
	if len(blob) < 1+ns+c.aead.Overhead() {
		return nil, errors.New("admin: encrypted key blob is truncated")
	}
	if blob[0] != cryptoVersion {
		return nil, fmt.Errorf("admin: unknown encrypted key format version 0x%02x", blob[0])
	}
	plaintext, err := c.aead.Open(nil, blob[1:1+ns], blob[1+ns:], []byte(provider))
	if err != nil {
		return nil, fmt.Errorf("admin: decrypt provider key: %w", err)
	}
	return plaintext, nil
}

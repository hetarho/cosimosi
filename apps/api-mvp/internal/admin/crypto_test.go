package admin

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

func testCipher(t *testing.T) *Cipher {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	c, err := NewCipher(base64.StdEncoding.EncodeToString(key))
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	return c
}

func TestSealOpenRoundTrip(t *testing.T) {
	c := testCipher(t)
	blob, err := c.Seal("openai", []byte("sk-secret-123"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if blob[0] != cryptoVersion {
		t.Fatalf("version byte = 0x%02x, want 0x%02x", blob[0], cryptoVersion)
	}
	got, err := c.Open("openai", blob)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if string(got) != "sk-secret-123" {
		t.Fatalf("round trip = %q", got)
	}
}

func TestOpenRejectsProviderSwap(t *testing.T) {
	// AAD = provider: a blob copied onto another provider's row must not
	// decrypt (acceptance 1.4).
	c := testCipher(t)
	blob, err := c.Seal("openai", []byte("sk-secret"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if _, err := c.Open("claude", blob); err == nil {
		t.Fatal("cross-provider blob must fail to decrypt")
	}
}

func TestOpenRejectsTruncatedAndWrongVersion(t *testing.T) {
	c := testCipher(t)
	blob, err := c.Seal("openai", []byte("sk-secret"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if _, err := c.Open("openai", blob[:8]); err == nil {
		t.Fatal("truncated blob must fail")
	}
	tampered := append([]byte{0x7f}, blob[1:]...)
	if _, err := c.Open("openai", tampered); err == nil || !strings.Contains(err.Error(), "version") {
		t.Fatalf("wrong version byte must fail naming version, got %v", err)
	}
}

func TestNilCipherFailsWithMissingKeyError(t *testing.T) {
	// Empty env = valid unconfigured state; writes surface the env name (1.3).
	c, err := NewCipher("")
	if err != nil {
		t.Fatalf("empty key must not error at construction: %v", err)
	}
	if c != nil {
		t.Fatal("empty key should yield a nil cipher")
	}
	if _, err := c.Seal("openai", []byte("k")); !errors.Is(err, ErrEncryptionKeyMissing) {
		t.Fatalf("Seal on nil cipher = %v, want ErrEncryptionKeyMissing", err)
	}
	if _, err := c.Open("openai", []byte{1}); !errors.Is(err, ErrEncryptionKeyMissing) {
		t.Fatalf("Open on nil cipher = %v, want ErrEncryptionKeyMissing", err)
	}
}

func TestNewCipherValidatesKey(t *testing.T) {
	if _, err := NewCipher("not-base64!!!"); err == nil || !strings.Contains(err.Error(), KeyEnvName) {
		t.Fatalf("invalid base64 must name the env var, got %v", err)
	}
	short := base64.StdEncoding.EncodeToString([]byte("too-short"))
	if _, err := NewCipher(short); err == nil || !strings.Contains(err.Error(), "32 bytes") {
		t.Fatalf("short key must demand 32 bytes, got %v", err)
	}
}

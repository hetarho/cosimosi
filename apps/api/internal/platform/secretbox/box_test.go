package secretbox

import (
	"bytes"
	"errors"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	box, err := New(bytes.Repeat([]byte("k"), 32))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	plaintext := []byte("sk-provider-key-123")
	ciphertext, err := box.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if bytes.Contains(ciphertext, plaintext) {
		t.Fatal("ciphertext must not contain the plaintext key")
	}
	got, err := box.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Errorf("round-trip = %q, want %q", got, plaintext)
	}
	// Each encryption uses a fresh nonce, so identical plaintext yields distinct ciphertext.
	other, _ := box.Encrypt(plaintext)
	if bytes.Equal(ciphertext, other) {
		t.Error("expected a fresh nonce per encryption")
	}
}

func TestInvalidKeyLength(t *testing.T) {
	if _, err := New([]byte("short")); !errors.Is(err, ErrKeyLength) {
		t.Fatalf("New(short) err = %v, want ErrKeyLength", err)
	}
}

func TestDisabledFailsClosed(t *testing.T) {
	if _, err := (Disabled{}).Encrypt([]byte("x")); !errors.Is(err, ErrDisabled) {
		t.Fatalf("Disabled.Encrypt err = %v, want ErrDisabled", err)
	}
	if (Disabled{}).Hint("abcdefgh") == "" {
		t.Error("Disabled still masks for display")
	}
}

func TestHintMasksTail(t *testing.T) {
	if got := Hint("abcdefgh"); got != "…efgh" {
		t.Errorf("Hint = %q, want …efgh", got)
	}
	if got := Hint("ab"); got != "…" {
		t.Errorf("Hint(short) = %q, want …", got)
	}
}

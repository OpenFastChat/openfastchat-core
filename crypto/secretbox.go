// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Package crypto encrypts provider API keys at rest with
// AES-256-GCM under a master key from the environment, so a
// database leak never yields usable secrets.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// SecretBox seals and opens secrets with one 32-byte key.
type SecretBox struct {
	gcm cipher.AEAD
}

var ErrNoKey = errors.New("crypto: master key not configured")

// New builds a SecretBox from a base64-encoded 32-byte key.
// An empty key returns ErrNoKey so callers can decide whether
// to bootstrap one.
func New(base64Key string) (*SecretBox, error) {
	if base64Key == "" {
		return nil, ErrNoKey
	}
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("crypto: decode key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf(
			"crypto: key must be 32 bytes, got %d", len(key),
		)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("crypto: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: new gcm: %w", err)
	}
	return &SecretBox{gcm: gcm}, nil
}

// Encrypt seals plaintext, returning nonce-prefixed ciphertext.
func (s *SecretBox) Encrypt(plaintext string) ([]byte, error) {
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("crypto: nonce: %w", err)
	}
	return s.gcm.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

// Decrypt opens nonce-prefixed ciphertext produced by Encrypt.
func (s *SecretBox) Decrypt(ciphertext []byte) (string, error) {
	ns := s.gcm.NonceSize()
	if len(ciphertext) < ns {
		return "", errors.New("crypto: ciphertext too short")
	}
	nonce, body := ciphertext[:ns], ciphertext[ns:]
	plain, err := s.gcm.Open(nil, nonce, body, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: open: %w", err)
	}
	return string(plain), nil
}

// GenerateKey returns a fresh base64-encoded 32-byte key for
// first-run bootstrap.
func GenerateKey() (string, error) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

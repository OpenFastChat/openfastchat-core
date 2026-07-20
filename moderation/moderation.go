// Package moderation rejects user-supplied display text (usernames, chat
// titles, flow names) that contains profanity, so the same rules apply
// everywhere a name is accepted. It wraps github.com/TwiN/go-away, which
// sanitises leetspeak and spacing tricks (f.u.c.k, fück) and carries a
// false-positive list (assassin, class, scunthorpe).
package moderation

import (
	"errors"

	goaway "github.com/TwiN/go-away"
)

// ErrProfane reports that the supplied text contains profanity.
var ErrProfane = errors.New("name contains inappropriate language")

// CheckName returns ErrProfane when name contains profanity and nil otherwise.
// Empty input is treated as clean; callers validate length separately.
func CheckName(name string) error {
	if name == "" {
		return nil
	}
	if goaway.IsProfane(name) {
		return ErrProfane
	}
	return nil
}

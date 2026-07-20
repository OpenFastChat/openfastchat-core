package handler

import (
	"context"
	_ "embed"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/middleware"
	store "github.com/1-Bart-1/openfastchat-core/store"
	"github.com/1-Bart-1/openfastchat-core/usernames"

	"github.com/google/uuid"
)

//go:embed welcome.md
var welcomeMarkdown string

type welcomePair struct {
	question, answer string
}

var welcomePairs = parseWelcome(welcomeMarkdown)

// WelcomeMessages serves the seeded welcome conversation as
// a list of messages so anonymous visitors can preview it
// before any guest provisioning happens. The shape mirrors
// /api/threads/{id}/messages so the frontend can render it
// through the same code path.
func WelcomeMessages(
	w http.ResponseWriter, r *http.Request,
) {
	type msg struct {
		ID      string `json:"id"`
		Role    string `json:"role"`
		Content string `json:"content"`
		Status  string `json:"status"`
	}
	out := make([]msg, 0, len(welcomePairs)*2)
	for i, p := range welcomePairs {
		out = append(out, msg{
			ID:      fmt.Sprintf("welcome-u-%d", i),
			Role:    "user",
			Content: p.question,
			Status:  "complete",
		})
		out = append(out, msg{
			ID:      fmt.Sprintf("welcome-a-%d", i),
			Role:    "assistant",
			Content: p.answer,
			Status:  "complete",
		})
	}
	WriteJSON(w, http.StatusOK, out)
}

func parseWelcome(src string) []welcomePair {
	var pairs []welcomePair
	var current welcomePair
	var body strings.Builder
	flush := func() {
		if current.question == "" {
			return
		}
		current.answer = strings.TrimSpace(body.String())
		pairs = append(pairs, current)
	}
	for _, line := range strings.Split(src, "\n") {
		if strings.HasPrefix(line, "# ") {
			flush()
			current = welcomePair{
				question: strings.TrimSpace(line[2:]),
			}
			body.Reset()
			continue
		}
		body.WriteString(line)
		body.WriteString("\n")
	}
	flush()
	return pairs
}

func ProvisionUserDefaults(
	ctx context.Context,
	queries *store.Queries,
	userID uuid.UUID,
) {
	thread, err := queries.CreateThread(ctx, userID)
	if err != nil {
		slog.Error("provision thread", "err", err)
		return
	}
	seedWelcomeMessages(ctx, queries, thread.ID, userID)
}

func seedWelcomeMessages(
	ctx context.Context,
	queries *store.Queries,
	threadID, userID uuid.UUID,
) {
	for _, p := range welcomePairs {
		if _, err := queries.CreateMessage(
			ctx, store.CreateMessageParams{
				ThreadID: threadID,
				Role:     "user",
				Content:  p.question,
				Status:   "complete",
			},
		); err != nil {
			slog.Error("seed welcome question", "err", err)
			return
		}
		if _, err := queries.CreateMessage(
			ctx, store.CreateMessageParams{
				ThreadID: threadID,
				Role:     "assistant",
				Content:  p.answer,
				Status:   "complete",
			},
		); err != nil {
			slog.Error("seed welcome answer", "err", err)
			return
		}
	}
	if err := queries.UpdateThreadTitle(
		ctx, store.UpdateThreadTitleParams{
			ID:     threadID,
			UserID: userID,
			Title:  "Welcome to OpenFastChat",
		},
	); err != nil {
		slog.Error("seed welcome title", "err", err)
	}
}

func ProvisionGuestUser(
	ctx context.Context, queries *store.Queries,
) (uuid.UUID, string, error) {
	email := "guest-" + uuid.NewString() + middleware.GuestEmailSuffix
	user, err := queries.CreateGuestUser(
		ctx, store.CreateGuestUserParams{
			Email:       email,
			DisplayName: usernames.Generate(),
		},
	)
	if err != nil {
		return uuid.Nil, "", err
	}
	ProvisionUserDefaults(ctx, queries, user.ID)
	return user.ID, user.Email, nil
}

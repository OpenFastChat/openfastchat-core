-- Users (core identity columns only; billing columns live in the hosted layer)

-- name: GetUserByID :one
SELECT id, email, oauth_provider, oauth_id, preferred_model, created_at,
       is_guest, guest_llm_calls_used, display_name, default_flow_id,
       deleted_at, email_verified, node_menu
FROM users WHERE id = $1 AND deleted_at IS NULL;

-- name: GetUserByOAuthID :one
SELECT id, email, oauth_provider, oauth_id, preferred_model, created_at,
       is_guest, guest_llm_calls_used, display_name, default_flow_id,
       deleted_at, email_verified, node_menu
FROM users
WHERE oauth_provider = $1 AND oauth_id = $2 AND deleted_at IS NULL;

-- name: GetUserByEmail :one
SELECT id, email, oauth_provider, oauth_id, preferred_model, created_at,
       is_guest, guest_llm_calls_used, display_name, default_flow_id,
       deleted_at, email_verified, node_menu
FROM users WHERE email = $1 AND deleted_at IS NULL;

-- name: GetUserAny :one
SELECT id, email, oauth_provider, oauth_id, preferred_model, created_at,
       is_guest, guest_llm_calls_used, display_name, default_flow_id,
       deleted_at, email_verified, node_menu
FROM users
WHERE id = sqlc.arg('id')::uuid OR email = sqlc.arg('email')::text
ORDER BY (id = sqlc.arg('id')::uuid) DESC
LIMIT 1;

-- name: CreateOAuthUser :one
INSERT INTO users (
    email, oauth_provider, oauth_id, display_name, email_verified
) VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, oauth_provider, oauth_id, preferred_model, created_at,
          is_guest, guest_llm_calls_used, display_name, default_flow_id,
          deleted_at, email_verified, node_menu;

-- name: CreateGuestUser :one
INSERT INTO users (email, is_guest, display_name)
VALUES ($1, TRUE, $2)
RETURNING id, email, oauth_provider, oauth_id, preferred_model, created_at,
          is_guest, guest_llm_calls_used, display_name, default_flow_id,
          deleted_at, email_verified, node_menu;

-- name: SetEmailVerified :exec
UPDATE users SET email_verified = TRUE WHERE id = $1;

-- name: UpdateDisplayName :exec
UPDATE users SET display_name = $2 WHERE id = $1;

-- name: SetUserDisplayName :exec
UPDATE users SET display_name = $2 WHERE id = $1;

-- name: DisplayNameTaken :one
SELECT EXISTS(
    SELECT 1 FROM users
    WHERE LOWER(display_name) = LOWER($1)
      AND id <> $2 AND deleted_at IS NULL
)::bool;

-- name: ListAutoDisplayNames :many
SELECT id FROM users
WHERE display_name = ''
   OR display_name ~ '^user_[0-9a-f]{8}$';

-- name: GetPreferredModel :one
SELECT preferred_model FROM users WHERE id = $1;

-- name: UpdatePreferredModel :exec
UPDATE users SET preferred_model = $2 WHERE id = $1;

-- name: GetNodeMenu :one
SELECT node_menu FROM users WHERE id = $1;

-- name: UpdateNodeMenu :exec
UPDATE users SET node_menu = $2 WHERE id = $1;

-- name: SetUserDefaultFlow :exec
UPDATE users SET default_flow_id = $2 WHERE id = $1;

-- name: GetTemplateUserID :one
SELECT id FROM users
WHERE email = 'templates@openfastchat.internal';

-- name: IncrementGuestLLMCallIfBelow :one
UPDATE users
SET guest_llm_calls_used = guest_llm_calls_used + 1
WHERE id = $1 AND is_guest AND guest_llm_calls_used < $2
RETURNING guest_llm_calls_used;

-- name: UpgradeGuestToOAuthUser :exec
UPDATE users
SET email = $2,
    oauth_provider = $3,
    oauth_id = $4,
    is_guest = FALSE,
    guest_llm_calls_used = 0
WHERE id = $1 AND is_guest;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: HardDeleteStaleGuests :execrows
DELETE FROM users
WHERE is_guest
  AND deleted_at IS NULL
  AND created_at < NOW() - INTERVAL '30 days';

-- name: CountGuests :one
SELECT COUNT(*)::int FROM users WHERE is_guest AND deleted_at IS NULL;

-- Deleted-account cooldown

-- name: InsertDeletedAccount :exec
INSERT INTO deleted_accounts (email_hash)
VALUES ($1)
ON CONFLICT (email_hash) DO UPDATE
SET deleted_at = NOW();

-- name: IsEmailDeleted :one
SELECT EXISTS(
    SELECT 1 FROM deleted_accounts
    WHERE email_hash = $1
      AND deleted_at > NOW() - INTERVAL '30 days'
) AS is_deleted;

-- name: DeleteDeletedAccount :execrows
DELETE FROM deleted_accounts WHERE email_hash = $1;

-- Threads

-- name: CreateThread :one
INSERT INTO threads (user_id)
VALUES ($1)
RETURNING *;

-- name: GetThreadByUserID :one
SELECT * FROM threads WHERE user_id = $1
ORDER BY updated_at DESC LIMIT 1;

-- name: GetThreadByID :one
SELECT * FROM threads WHERE id = $1 AND user_id = $2;

-- name: ListThreadsByUser :many
SELECT id, title, updated_at, scroll_top_fraction
FROM threads WHERE user_id = $1
ORDER BY updated_at DESC;

-- name: UpdateThreadScroll :exec
UPDATE threads
SET scroll_top_fraction = $3
WHERE id = $1 AND user_id = $2;

-- name: UpdateThreadTitle :exec
UPDATE threads SET title = $3
WHERE id = $1 AND user_id = $2;

-- name: UpdateThreadUpdatedAt :exec
UPDATE threads SET updated_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: DeleteThread :exec
DELETE FROM threads WHERE id = $1 AND user_id = $2;

-- name: ReparentGuestThreads :exec
UPDATE threads SET user_id = $2
WHERE user_id = $1
  AND title != 'Welcome to OpenFastChat';

-- Messages

-- name: CreateMessage :one
INSERT INTO messages (thread_id, role, content, status, context, candidates)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetThreadMessages :many
SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC;

-- name: DeleteThreadMessages :exec
DELETE FROM messages WHERE thread_id = $1;

-- Documents

-- name: CreateDocumentWithContent :one
INSERT INTO documents (user_id, filename, file_size, content, status)
VALUES ($1, $2, $3, $4, 'ready')
RETURNING *;

-- name: GetDocumentsByUser :many
SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC;

-- name: DeleteDocument :exec
DELETE FROM documents WHERE id = $1 AND user_id = $2;

-- Flows

-- name: CreateFlow :one
INSERT INTO flows (user_id, name, definition, description)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetFlowsByUser :many
SELECT
    f.id, f.user_id, f.name, f.definition, f.description,
    f.public_parent_id, f.created_at, f.updated_at,
    TRUE::boolean AS editable,
    (pf.flow_id IS NOT NULL)::boolean AS is_published,
    COALESCE(pf.is_featured, FALSE)::boolean AS is_featured,
    pf.definition_hash AS published_definition_hash
FROM flows f
LEFT JOIN published_flows pf ON pf.flow_id = f.id
WHERE f.user_id = $1 AND f.deleted_at IS NULL
ORDER BY f.updated_at DESC;

-- name: ListFeaturedFlows :many
SELECT
    f.id, f.user_id, pf.name, pf.definition, pf.description,
    f.public_parent_id, f.created_at, pf.updated_at,
    FALSE::boolean AS editable,
    TRUE::boolean  AS is_published,
    TRUE::boolean  AS is_featured
FROM flows f
JOIN published_flows pf ON pf.flow_id = f.id
WHERE pf.is_featured AND f.user_id <> $1 AND f.deleted_at IS NULL
ORDER BY pf.name;

-- name: GetFlowByID :one
SELECT
    f.id, f.user_id, f.name, f.definition, f.description,
    f.public_parent_id, f.created_at, f.updated_at,
    (pf.flow_id IS NOT NULL)::boolean AS is_published,
    COALESCE(pf.is_featured, FALSE)::boolean AS is_featured,
    pf.definition_hash AS published_definition_hash
FROM flows f
LEFT JOIN published_flows pf ON pf.flow_id = f.id
WHERE f.id = $1 AND f.user_id = $2 AND f.deleted_at IS NULL;

-- name: UpdateFlow :exec
UPDATE flows
SET definition = $3,
    name = $4,
    description = $5,
    updated_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: DeleteFlow :exec
UPDATE flows SET deleted_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: ReparentGuestFlows :exec
UPDATE flows SET user_id = $2 WHERE user_id = $1;

-- name: ResetFlowToPublicParent :exec
UPDATE flows f
SET definition = pf.definition,
    name = pf.name,
    updated_at = NOW()
FROM published_flows pf
WHERE f.id = $1 AND f.user_id = $2
  AND f.public_parent_id = pf.flow_id;

-- Reassign a deleting user's published flows to the anonymous sentinel so
-- community content survives the hard delete. Run BEFORE deleting the user.

-- name: ReassignUserPublishedFlowsToAnon :exec
UPDATE flows
SET user_id = (
        SELECT id FROM users
        WHERE email = 'anonymous@openfastchat.internal'
    )
WHERE flows.id IN (SELECT flow_id FROM published_flows)
  AND flows.user_id = $1;

-- name: ReassignUserPublishedFlowOwnersToAnon :exec
UPDATE published_flows
SET user_id = (
        SELECT id FROM users
        WHERE email = 'anonymous@openfastchat.internal'
    ),
    name = name || ' (' || left(flow_id::text, 8) || ')'
WHERE user_id = $1;

-- Published flows / marketplace

-- name: PublishFlow :exec
INSERT INTO published_flows
    (flow_id, user_id, name, description,
     definition, definition_hash, is_featured)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (flow_id) DO UPDATE
    SET name            = EXCLUDED.name,
        description     = EXCLUDED.description,
        definition      = EXCLUDED.definition,
        definition_hash = EXCLUDED.definition_hash,
        is_featured     = EXCLUDED.is_featured,
        updated_at      = NOW();

-- name: UnpublishFlow :exec
DELETE FROM published_flows WHERE flow_id = $1;

-- name: GetPublishedFlowByHash :one
SELECT flow_id FROM published_flows
WHERE definition_hash = $1 AND flow_id <> $2
LIMIT 1;

-- name: GetPublishedFlowDupByHash :one
SELECT flow_id, name FROM published_flows
WHERE definition_hash = $1 AND flow_id <> $2
LIMIT 1;

-- name: ListPublicFlows :many
SELECT
    pf.flow_id   AS id,
    pf.name,
    pf.description,
    pf.definition,
    f.user_id,
    f.public_parent_id,
    pf.updated_at,
    u.display_name AS author_display_name,
    COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0)::int  AS up_count,
    COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0)::int AS down_count,
    COALESCE(
        (SELECT v2.vote FROM flow_votes v2
         WHERE v2.flow_id = pf.flow_id AND v2.user_id = $1), 0
    )::int AS current_user_vote,
    COALESCE(SUM(
        CASE
            WHEN v.created_at > NOW() - INTERVAL '7 days'
                 AND v.vote = 1  THEN 1
            WHEN v.created_at > NOW() - INTERVAL '7 days'
                 AND v.vote = -1 THEN -1
            ELSE 0
        END
    ), 0)::int AS hot_score
FROM published_flows pf
JOIN flows f ON f.id = pf.flow_id
JOIN users u ON f.user_id = u.id
LEFT JOIN flow_votes v ON v.flow_id = pf.flow_id
WHERE f.deleted_at IS NULL
GROUP BY pf.flow_id, f.user_id, f.public_parent_id, u.display_name
ORDER BY
    CASE WHEN sqlc.arg('sort')::text = 'new' THEN pf.updated_at END DESC,
    CASE WHEN sqlc.arg('sort')::text = 'hot' THEN COALESCE(SUM(
        CASE
            WHEN v.created_at > NOW() - INTERVAL '7 days'
                 AND v.vote = 1  THEN 1
            WHEN v.created_at > NOW() - INTERVAL '7 days'
                 AND v.vote = -1 THEN -1
            ELSE 0
        END
    ), 0) END DESC,
    CASE WHEN sqlc.arg('sort')::text NOT IN ('new', 'hot') THEN (
        COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0)
    ) END DESC,
    pf.updated_at DESC
LIMIT 100;

-- name: SearchPublicFlows :many
SELECT
    pf.flow_id   AS id,
    pf.name,
    pf.description,
    pf.definition,
    f.user_id,
    f.public_parent_id,
    pf.updated_at,
    u.display_name AS author_display_name,
    COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0)::int  AS up_count,
    COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0)::int AS down_count,
    COALESCE(
        (SELECT v2.vote FROM flow_votes v2
         WHERE v2.flow_id = pf.flow_id AND v2.user_id = @user_id), 0
    )::int AS current_user_vote,
    GREATEST(
        similarity(pf.name, @query),
        similarity(COALESCE(pf.description, ''), @query),
        similarity(u.display_name, @query)
    )::float8 AS match_score
FROM published_flows pf
JOIN flows f ON f.id = pf.flow_id
JOIN users u ON f.user_id = u.id
LEFT JOIN flow_votes v ON v.flow_id = pf.flow_id
WHERE f.deleted_at IS NULL
  AND (pf.name % @query
   OR COALESCE(pf.description, '') % @query
   OR u.display_name % @query)
GROUP BY pf.flow_id, f.user_id, f.public_parent_id, u.display_name
ORDER BY match_score DESC, pf.updated_at DESC
LIMIT 100;

-- name: GetPublicFlowByID :one
SELECT
    pf.flow_id   AS id,
    pf.name,
    pf.description,
    pf.definition,
    f.user_id,
    f.public_parent_id,
    pf.updated_at,
    u.display_name AS author_display_name
FROM published_flows pf
JOIN flows f ON f.id = pf.flow_id
JOIN users u ON f.user_id = u.id
WHERE pf.flow_id = $1 AND f.deleted_at IS NULL;

-- name: ListPublicFlowsForSitemap :many
SELECT pf.flow_id AS id, pf.updated_at
FROM published_flows pf
JOIN flows f ON f.id = pf.flow_id
WHERE f.deleted_at IS NULL
ORDER BY pf.updated_at DESC;

-- name: UpsertFlowVote :exec
INSERT INTO flow_votes (flow_id, user_id, vote)
VALUES ($1, $2, $3)
ON CONFLICT (flow_id, user_id) DO UPDATE
SET vote = EXCLUDED.vote,
    updated_at = NOW();

-- name: DeleteFlowVote :exec
DELETE FROM flow_votes WHERE flow_id = $1 AND user_id = $2;

-- name: CountPublishEventsLast24h :one
SELECT COUNT(*)::int FROM flow_publish_events
WHERE user_id = $1
  AND created_at > NOW() - INTERVAL '24 hours';

-- name: InsertPublishEvent :exec
INSERT INTO flow_publish_events (user_id, flow_id)
VALUES ($1, $2);

-- Events

-- name: InsertErrorEvent :exec
INSERT INTO error_events (user_id, method, path, status_code, message)
VALUES ($1, $2, $3, $4, $5);

-- name: InsertReportedIssue :exec
INSERT INTO reported_issues (
    user_id, kind, status_code, http_method, http_path,
    message, user_comment, context
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: InsertAccessEvent :exec
INSERT INTO access_events (
    user_id, email_hash, kind, ip, user_agent, ref_id
) VALUES (
    sqlc.arg('user_id'),
    encode(digest(lower(sqlc.arg('email')::text), 'sha256'), 'hex'),
    sqlc.arg('kind'), sqlc.arg('ip'),
    sqlc.arg('user_agent'), sqlc.arg('ref_id')
);

-- name: ListAccessEventsByEmailHash :many
SELECT id, kind, ip, user_agent, ref_id, created_at
FROM access_events
WHERE email_hash = $1
ORDER BY created_at ASC;

-- name: SummariseAccessByEmailHash :many
SELECT
    kind,
    COUNT(*)::bigint AS event_count,
    MIN(created_at)::timestamptz AS first_at,
    MAX(created_at)::timestamptz AS last_at,
    COUNT(DISTINCT ip)::bigint AS distinct_ips
FROM access_events
WHERE email_hash = $1
GROUP BY kind;

-- Providers

-- name: ListProviders :many
SELECT id, name, base_url, api_key_enc, enabled, created_at, updated_at
FROM providers
ORDER BY created_at ASC;

-- name: ListEnabledProviders :many
SELECT id, name, base_url, api_key_enc, enabled, created_at, updated_at
FROM providers
WHERE enabled = TRUE
ORDER BY created_at ASC;

-- name: GetProvider :one
SELECT id, name, base_url, api_key_enc, enabled, created_at, updated_at
FROM providers
WHERE id = $1;

-- name: CreateProvider :one
INSERT INTO providers (name, base_url, api_key_enc, enabled)
VALUES ($1, $2, $3, $4)
RETURNING id, name, base_url, api_key_enc, enabled, created_at, updated_at;

-- name: UpdateProvider :exec
UPDATE providers
SET base_url = $2, api_key_enc = $3, enabled = $4, updated_at = now()
WHERE id = $1;

-- name: UpdateProviderNoKey :exec
UPDATE providers
SET base_url = $2, enabled = $3, updated_at = now()
WHERE id = $1;

-- name: DeleteProvider :execrows
DELETE FROM providers WHERE id = $1;

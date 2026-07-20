-- +goose Up
-- Anonymous sentinel author: published flows are re-parented here when their
-- owner is hard-deleted, so community content survives. Looked up by email.
INSERT INTO users (email, display_name, oauth_provider, oauth_id)
SELECT 'anonymous@openfastchat.internal', 'anonymous', 'system', 'anonymous'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'anonymous@openfastchat.internal'
);

-- +goose Down
DELETE FROM users WHERE email = 'anonymous@openfastchat.internal';

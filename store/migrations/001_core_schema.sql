-- +goose Up
-- Shared schema for OpenFastChat core. Billing (payments, token_events,
-- search_events, limits, admin) lives in the hosted layer on top of this.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE TABLE users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    oauth_provider text DEFAULT ''::text NOT NULL,
    oauth_id text DEFAULT ''::text NOT NULL,
    preferred_model text DEFAULT 'llama-3.3-70b-versatile'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    is_guest boolean DEFAULT false NOT NULL,
    guest_llm_calls_used integer DEFAULT 0 NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    default_flow_id uuid,
    deleted_at timestamptz,
    email_verified boolean DEFAULT false NOT NULL,
    node_menu jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE UNIQUE INDEX uq_oauth ON users USING btree (oauth_provider, oauth_id)
    WHERE ((oauth_provider <> ''::text) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX users_email_active_idx ON users USING btree (email)
    WHERE (deleted_at IS NULL);
CREATE INDEX users_is_guest_created_at_idx ON users USING btree (created_at)
    WHERE is_guest;

CREATE TABLE flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Untitled Flow'::text NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    description text,
    public_parent_id uuid,
    deleted_at timestamptz,
    CONSTRAINT flows_pkey PRIMARY KEY (id),
    CONSTRAINT flows_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT flows_public_parent_id_fkey FOREIGN KEY (public_parent_id)
        REFERENCES flows(id) ON DELETE SET NULL
);
CREATE INDEX idx_flows_deleted_at ON flows USING btree (deleted_at)
    WHERE (deleted_at IS NOT NULL);
CREATE INDEX idx_flows_public_parent ON flows USING btree (public_parent_id)
    WHERE (public_parent_id IS NOT NULL);
CREATE INDEX idx_flows_user_id ON flows USING btree (user_id);

ALTER TABLE users ADD CONSTRAINT users_default_flow_id_fkey
    FOREIGN KEY (default_flow_id) REFERENCES flows(id) ON DELETE SET NULL;

CREATE TABLE threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    context_summary text,
    user_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    scroll_top_fraction real,
    CONSTRAINT threads_pkey PRIMARY KEY (id),
    CONSTRAINT threads_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'complete'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    context jsonb,
    candidates jsonb,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text]))),
    CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['complete'::text, 'streaming'::text, 'stopped'::text, 'error'::text]))),
    CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id)
        REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX messages_thread_id_created_at_idx ON messages USING btree (thread_id, created_at);

CREATE TABLE documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    filename text NOT NULL,
    file_size integer NOT NULL,
    content text,
    status text DEFAULT 'processing'::text NOT NULL,
    error_message text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT documents_pkey PRIMARY KEY (id),
    CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX documents_user_idx ON documents USING btree (user_id);

CREATE TABLE published_flows (
    flow_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    definition jsonb NOT NULL,
    definition_hash text NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    published_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT published_flows_pkey PRIMARY KEY (flow_id),
    CONSTRAINT published_flows_user_name_unique UNIQUE (user_id, name),
    CONSTRAINT published_flows_flow_id_fkey FOREIGN KEY (flow_id)
        REFERENCES flows(id) ON DELETE CASCADE,
    CONSTRAINT published_flows_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_published_flows_description_trgm ON published_flows
    USING gin (description gin_trgm_ops) WHERE (description IS NOT NULL);
CREATE INDEX idx_published_flows_featured ON published_flows
    USING btree (is_featured) WHERE is_featured;
CREATE INDEX idx_published_flows_hash ON published_flows USING btree (definition_hash);
CREATE INDEX idx_published_flows_name_trgm ON published_flows USING gin (name gin_trgm_ops);
CREATE INDEX idx_published_flows_updated ON published_flows USING btree (updated_at DESC);
CREATE INDEX idx_published_flows_user ON published_flows USING btree (user_id);

CREATE TABLE flow_votes (
    flow_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote smallint NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT flow_votes_pkey PRIMARY KEY (flow_id, user_id),
    CONSTRAINT flow_votes_vote_check CHECK ((vote = ANY (ARRAY['-1'::integer, 1]))),
    CONSTRAINT flow_votes_flow_id_fkey FOREIGN KEY (flow_id)
        REFERENCES flows(id) ON DELETE CASCADE,
    CONSTRAINT flow_votes_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_flow_votes_flow ON flow_votes USING btree (flow_id);

CREATE TABLE flow_publish_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    flow_id uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT flow_publish_events_pkey PRIMARY KEY (id),
    CONSTRAINT flow_publish_events_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT flow_publish_events_flow_id_fkey FOREIGN KEY (flow_id)
        REFERENCES flows(id) ON DELETE CASCADE
);
CREATE INDEX idx_publish_events_user_time ON flow_publish_events
    USING btree (user_id, created_at DESC);

CREATE TABLE access_events (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    ip text DEFAULT ''::text NOT NULL,
    user_agent text DEFAULT ''::text NOT NULL,
    ref_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    email_hash text,
    CONSTRAINT access_events_pkey PRIMARY KEY (id),
    CONSTRAINT access_events_kind_check CHECK ((kind = ANY (ARRAY['login'::text, 'chat'::text, 'topup'::text, 'subscribe'::text])))
);
CREATE INDEX access_events_email_hash_idx ON access_events USING btree (email_hash);
CREATE INDEX access_events_user_idx ON access_events USING btree (user_id, created_at);

CREATE TABLE error_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    method text NOT NULL,
    path text NOT NULL,
    status_code integer NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT error_events_pkey PRIMARY KEY (id),
    CONSTRAINT error_events_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_error_events_created ON error_events USING btree (created_at DESC);
CREATE INDEX idx_error_events_status_created ON error_events USING btree (status_code, created_at DESC);

CREATE TABLE reported_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    kind text NOT NULL,
    status_code integer DEFAULT 0 NOT NULL,
    http_method text DEFAULT ''::text NOT NULL,
    http_path text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    user_comment text DEFAULT ''::text NOT NULL,
    context jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT reported_issues_pkey PRIMARY KEY (id),
    CONSTRAINT reported_issues_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_reported_issues_created ON reported_issues USING btree (created_at DESC);

CREATE TABLE providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    base_url text NOT NULL,
    api_key_enc bytea,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT providers_pkey PRIMARY KEY (id),
    CONSTRAINT providers_name_key UNIQUE (name)
);

CREATE TABLE deleted_accounts (
    email_hash text NOT NULL,
    deleted_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT deleted_accounts_pkey PRIMARY KEY (email_hash)
);

-- +goose Down
DROP TABLE IF EXISTS deleted_accounts;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS reported_issues;
DROP TABLE IF EXISTS error_events;
DROP TABLE IF EXISTS access_events;
DROP TABLE IF EXISTS flow_publish_events;
DROP TABLE IF EXISTS flow_votes;
DROP TABLE IF EXISTS published_flows;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS threads;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_default_flow_id_fkey;
DROP TABLE IF EXISTS flows;
DROP TABLE IF EXISTS users;

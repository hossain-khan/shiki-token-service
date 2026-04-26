-- ── Schema: app ──────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS app;

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────

CREATE TYPE app.user_role   AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE app.user_status AS ENUM ('active', 'suspended', 'deleted');

-- ── Tables ─────────────────────────────────────────────────────────────────────

CREATE TABLE app.users (
    id          BIGSERIAL        PRIMARY KEY,
    uid         UUID             NOT NULL DEFAULT gen_random_uuid(),
    name        TEXT             NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    email       TEXT             NOT NULL CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
    password_hash TEXT           NOT NULL,
    role        app.user_role    NOT NULL DEFAULT 'viewer',
    status      app.user_status  NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_uid_idx   ON app.users (uid);
CREATE UNIQUE INDEX users_email_idx ON app.users (lower(email));
CREATE        INDEX users_role_idx  ON app.users (role);
CREATE        INDEX users_status_idx ON app.users (status);

CREATE TABLE app.sessions (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
    token_hash  TEXT         NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sessions_token_idx   ON app.sessions (token_hash);
CREATE        INDEX sessions_user_idx    ON app.sessions (user_id);
CREATE        INDEX sessions_expires_idx ON app.sessions (expires_at);

CREATE TABLE app.audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       REFERENCES app.users (id) ON DELETE SET NULL,
    action      TEXT         NOT NULL,
    resource    TEXT         NOT NULL,
    resource_id TEXT,
    metadata    JSONB,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_user_idx     ON app.audit_log (user_id);
CREATE INDEX audit_log_action_idx   ON app.audit_log (action);
CREATE INDEX audit_log_resource_idx ON app.audit_log (resource, resource_id);
CREATE INDEX audit_log_occurred_idx ON app.audit_log (occurred_at);

-- ── Trigger: auto-update updated_at ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON app.users
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

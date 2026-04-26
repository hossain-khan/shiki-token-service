-- ── Schema: analytics ─────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS analytics;

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────

CREATE TYPE analytics.event_category AS ENUM (
    'page_view', 'click', 'form_submit', 'api_call', 'error', 'custom'
);

CREATE TYPE analytics.device_type AS ENUM ('desktop', 'mobile', 'tablet', 'bot', 'unknown');

-- ── Core tables ────────────────────────────────────────────────────────────────

CREATE TABLE analytics.sites (
    id           BIGSERIAL    PRIMARY KEY,
    uid          UUID         NOT NULL DEFAULT gen_random_uuid(),
    domain       TEXT         NOT NULL,
    owner_id     BIGINT       NOT NULL,
    timezone     TEXT         NOT NULL DEFAULT 'UTC',
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sites_uid_idx    ON analytics.sites (uid);
CREATE UNIQUE INDEX sites_domain_idx ON analytics.sites (lower(domain));
CREATE        INDEX sites_owner_idx  ON analytics.sites (owner_id);

CREATE TABLE analytics.events (
    id           BIGSERIAL                   PRIMARY KEY,
    site_id      BIGINT                      NOT NULL REFERENCES analytics.sites (id) ON DELETE CASCADE,
    session_id   UUID                        NOT NULL,
    visitor_id   UUID                        NOT NULL,
    category     analytics.event_category    NOT NULL,
    name         TEXT                        NOT NULL,
    url          TEXT,
    referrer     TEXT,
    device_type  analytics.device_type       NOT NULL DEFAULT 'unknown',
    country_code CHAR(2),
    properties   JSONB,
    occurred_at  TIMESTAMPTZ                 NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions (example: current + next month)
CREATE TABLE analytics.events_2026_04 PARTITION OF analytics.events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE analytics.events_2026_05 PARTITION OF analytics.events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE analytics.events_2026_06 PARTITION OF analytics.events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX events_site_idx     ON analytics.events (site_id, occurred_at DESC);
CREATE INDEX events_visitor_idx  ON analytics.events (visitor_id, occurred_at DESC);
CREATE INDEX events_session_idx  ON analytics.events (session_id);
CREATE INDEX events_category_idx ON analytics.events (site_id, category, occurred_at DESC);
CREATE INDEX events_props_gin    ON analytics.events USING GIN (properties);

-- ── Sessions rollup ────────────────────────────────────────────────────────────

CREATE TABLE analytics.sessions (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    site_id        BIGINT       NOT NULL REFERENCES analytics.sites (id) ON DELETE CASCADE,
    visitor_id     UUID         NOT NULL,
    entry_url      TEXT,
    exit_url       TEXT,
    referrer       TEXT,
    device_type    analytics.device_type NOT NULL DEFAULT 'unknown',
    country_code   CHAR(2),
    page_views     INT          NOT NULL DEFAULT 0,
    duration_s     INT          NOT NULL DEFAULT 0,
    is_bounce      BOOLEAN      NOT NULL DEFAULT true,
    started_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ended_at       TIMESTAMPTZ,
    PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);

CREATE TABLE analytics.sessions_2026_04 PARTITION OF analytics.sessions
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE analytics.sessions_2026_05 PARTITION OF analytics.sessions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX sessions_site_idx    ON analytics.sessions (site_id, started_at DESC);
CREATE INDEX sessions_visitor_idx ON analytics.sessions (visitor_id, started_at DESC);

-- ── Daily aggregates (materialized) ───────────────────────────────────────────

CREATE TABLE analytics.daily_stats (
    site_id       BIGINT      NOT NULL REFERENCES analytics.sites (id) ON DELETE CASCADE,
    stat_date     DATE        NOT NULL,
    page_views    BIGINT      NOT NULL DEFAULT 0,
    unique_visitors BIGINT    NOT NULL DEFAULT 0,
    sessions      BIGINT      NOT NULL DEFAULT 0,
    bounce_rate   NUMERIC(5,2),
    avg_duration_s NUMERIC(8,2),
    PRIMARY KEY (site_id, stat_date)
);

CREATE INDEX daily_stats_date_idx ON analytics.daily_stats (stat_date DESC);

-- ── Views ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW analytics.top_pages AS
SELECT
    site_id,
    date_trunc('day', occurred_at) AS day,
    url,
    COUNT(*) AS page_views,
    COUNT(DISTINCT visitor_id) AS unique_visitors
FROM analytics.events
WHERE category = 'page_view'
  AND url IS NOT NULL
GROUP BY site_id, day, url;

CREATE OR REPLACE VIEW analytics.top_referrers AS
SELECT
    site_id,
    date_trunc('day', occurred_at) AS day,
    referrer,
    COUNT(*) AS visits,
    COUNT(DISTINCT visitor_id) AS unique_visitors
FROM analytics.events
WHERE referrer IS NOT NULL
  AND category = 'page_view'
GROUP BY site_id, day, referrer;

-- ── Functions ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION analytics.upsert_daily_stats(
    p_site_id   BIGINT,
    p_stat_date DATE
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO analytics.daily_stats (site_id, stat_date, page_views, unique_visitors, sessions, bounce_rate, avg_duration_s)
    SELECT
        p_site_id,
        p_stat_date,
        COALESCE(SUM(CASE WHEN e.category = 'page_view' THEN 1 ELSE 0 END), 0),
        COUNT(DISTINCT e.visitor_id),
        COUNT(DISTINCT s.id),
        ROUND(
            100.0 * COUNT(DISTINCT CASE WHEN s.is_bounce THEN s.id END)
            / NULLIF(COUNT(DISTINCT s.id), 0), 2
        ),
        ROUND(AVG(s.duration_s), 2)
    FROM analytics.events e
    LEFT JOIN analytics.sessions s
           ON s.id = e.session_id::UUID
          AND s.site_id = e.site_id
    WHERE e.site_id = p_site_id
      AND e.occurred_at::DATE = p_stat_date
    ON CONFLICT (site_id, stat_date) DO UPDATE
        SET page_views       = EXCLUDED.page_views,
            unique_visitors  = EXCLUDED.unique_visitors,
            sessions         = EXCLUDED.sessions,
            bounce_rate      = EXCLUDED.bounce_rate,
            avg_duration_s   = EXCLUDED.avg_duration_s;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RegRadar data spine: portable PostgreSQL schema, version 1
--
-- Status: DESIGN, NOT DEPLOYED. The prototype stores the spine in the
-- browser (docs/rr-core.js, localStorage adapter). This file is what the
-- Postgres adapter will run against once the owner chooses a host and an
-- EU region (decisions/002-free-prototype-stack.md).
--
-- Portability rules (decision 002):
--   * plain PostgreSQL 13+ only: no extensions, no vendor schemas, no
--     vendor auth functions. gen_random_uuid() is core since PG 13.
--   * every table carries org_id; row-level security isolates tenants
--     using a session setting the API sets per request:
--         SET LOCAL app.org_id = '<uuid>';  SET LOCAL app.actor = '<person id>';
--     (works on any Postgres host; map it to a host's own auth later
--     in a separate, optional file, never here).
--   * the browser never connects to the database; a small RegRadar API
--     does, through the same adapter interface (load/list/save/append).
--   * an organisation exports and restores as plain SQL (pg_dump with
--     --data-only filtered on org_id, or COPY ... WHERE org_id = ...).
--
-- Mapping from the browser spine:
--   meta     -> rr_meta       (schema version, settings)
--   entities -> rr_entity     (all entity types; type-specific fields in data jsonb)
--   links    -> rr_link       (typed links, soft-ended, never deleted)
--   events   -> rr_event      (append-only log with the same hash chain)
--   config.json -> rr_config  (one versioned row per organisation)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS rr_schema_version (
  version     integer      PRIMARY KEY,
  applied_at  timestamptz  NOT NULL DEFAULT now(),
  note        text         NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rr_organisation (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text         NOT NULL,
  firm_type   text         NOT NULL DEFAULT '',        -- ids from docs/data/applicability.json
  region      text         NOT NULL DEFAULT 'eu',      -- data residency label, informational
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Configuration over code: config.json per organisation, versioned (never edited in place).
CREATE TABLE IF NOT EXISTS rr_config (
  org_id      uuid         NOT NULL REFERENCES rr_organisation(id),
  version     integer      NOT NULL,
  config      jsonb        NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  text         NOT NULL DEFAULT '',
  PRIMARY KEY (org_id, version)
);

CREATE TABLE IF NOT EXISTS rr_meta (
  org_id      uuid         NOT NULL REFERENCES rr_organisation(id),
  id          text         NOT NULL,                   -- 'schema', 'settings'
  record      jsonb        NOT NULL,
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id)
);

-- One table for every entity type. Columns that every query needs are real
-- columns; the type-specific fields from config.json live in data.
CREATE TABLE IF NOT EXISTS rr_entity (
  org_id      uuid         NOT NULL REFERENCES rr_organisation(id),
  id          text         NOT NULL,                   -- stable spine id, e.g. 'TSK-K3F9A1', 'CTL:ctl-01'
  type        text         NOT NULL,                   -- an entity_types key in the config
  title       text         NOT NULL CHECK (length(title) > 0),
  status      text         NOT NULL,                   -- a workflow state id in the config
  owner_id    text         NULL,                       -- a person entity id
  due         date         NULL,
  data        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  origin      text         NOT NULL DEFAULT 'spine',   -- spine | demo | discovered | module:<id>
  src         jsonb        NULL,                       -- where a mirrored record came from
  src_hash    text         NULL,
  archived    boolean      NOT NULL DEFAULT false,     -- records are archived, not deleted
  rev         integer      NOT NULL DEFAULT 1,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  text         NOT NULL DEFAULT '',
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, owner_id) REFERENCES rr_entity(org_id, id)
);
CREATE INDEX IF NOT EXISTS rr_entity_type_status ON rr_entity (org_id, type, status) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS rr_entity_owner_due   ON rr_entity (org_id, owner_id, due) WHERE NOT archived;

-- Typed links. A link is ended (ended_at), never deleted, so the trail survives.
-- Reference records (obligations, regulations) live in the repo, not here, and
-- either end may be one (a regulation "affects" a control), so neither end is a
-- foreign key; the API checks both ends against rr_entity plus the reference set.
CREATE TABLE IF NOT EXISTS rr_link (
  org_id      uuid         NOT NULL REFERENCES rr_organisation(id),
  id          text         NOT NULL,                   -- 'L:<type>:<from>><to>'
  type        text         NOT NULL,                   -- a link_types id in the config
  from_id     text         NOT NULL,
  to_id       text         NOT NULL,
  origin      text         NOT NULL DEFAULT 'spine',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  text         NOT NULL DEFAULT '',
  ended_at    timestamptz  NULL,
  rev         integer      NOT NULL DEFAULT 1,
  PRIMARY KEY (org_id, id)
);
CREATE INDEX IF NOT EXISTS rr_link_from ON rr_link (org_id, from_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS rr_link_to   ON rr_link (org_id, to_id)   WHERE ended_at IS NULL;

-- The event log: who did what, when, to which record. Append-only.
CREATE TABLE IF NOT EXISTS rr_event (
  org_id      uuid         NOT NULL REFERENCES rr_organisation(id),
  id          text         NOT NULL,
  seq         bigint       NOT NULL,                   -- per organisation, gap-free in practice
  at          timestamptz  NOT NULL DEFAULT now(),
  actor       text         NOT NULL,                   -- person id, or system:<name>
  action      text         NOT NULL,                   -- create | update | move | assign | link | unlink | archive | import | sync | demo | settings | dispatch ...
  entity_id   text         NULL,
  entity_type text         NULL,
  title       text         NOT NULL DEFAULT '',
  changes     jsonb        NULL,                       -- {"field": [old, new]}
  link        jsonb        NULL,
  note        text         NOT NULL DEFAULT '',
  prev        text         NOT NULL,                   -- hash of the previous event ('0' for the first)
  hash        text         NOT NULL,                   -- same chain as rr-core.js (integrity check, not cryptographic)
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, seq)
);
CREATE INDEX IF NOT EXISTS rr_event_entity ON rr_event (org_id, entity_id, seq);

-- Append-only, enforced twice: a trigger refuses UPDATE and DELETE for everyone,
-- and the application role gets INSERT and SELECT only (grants below).
CREATE OR REPLACE FUNCTION rr_event_is_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rr_event is append-only (% refused)', TG_OP;
END;
$$;
DROP TRIGGER IF EXISTS rr_event_no_update ON rr_event;
CREATE TRIGGER rr_event_no_update BEFORE UPDATE OR DELETE ON rr_event
  FOR EACH ROW EXECUTE FUNCTION rr_event_is_append_only();

-- Row-level security keyed by organisation, from the first table (decision 002, rule 3).
ALTER TABLE rr_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_meta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_link   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_event  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rr_config_org ON rr_config;
CREATE POLICY rr_config_org ON rr_config USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
DROP POLICY IF EXISTS rr_meta_org ON rr_meta;
CREATE POLICY rr_meta_org ON rr_meta USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
DROP POLICY IF EXISTS rr_entity_org ON rr_entity;
CREATE POLICY rr_entity_org ON rr_entity USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
DROP POLICY IF EXISTS rr_link_org ON rr_link;
CREATE POLICY rr_link_org ON rr_link USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
DROP POLICY IF EXISTS rr_event_org ON rr_event;
CREATE POLICY rr_event_org ON rr_event USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

-- The API connects as rr_app (create the role once, outside this file, with a
-- password from the host's secret store; never in the repo):
--   CREATE ROLE rr_app LOGIN PASSWORD '...';
-- Then:
--   GRANT SELECT, INSERT, UPDATE ON rr_config, rr_meta, rr_entity, rr_link TO rr_app;
--   GRANT SELECT, INSERT ON rr_event TO rr_app;          -- no UPDATE, no DELETE
--   REVOKE DELETE ON rr_entity, rr_link FROM rr_app;      -- archive and end instead

INSERT INTO rr_schema_version (version, note) VALUES (1, 'Data spine v1: entities, links, events, config, meta')
  ON CONFLICT (version) DO NOTHING;

COMMIT;

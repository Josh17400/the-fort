-- The Fort analytics: one row per event. Apply with:
--   npx wrangler d1 execute fort-analytics --remote --file schema.sql
CREATE TABLE IF NOT EXISTS events (
  id    INTEGER PRIMARY KEY,
  iid   TEXT NOT NULL,     -- random install id (24 hex), made by the game; not linked to any person or device id
  sid   TEXT,              -- random session id (24 hex)
  name  TEXT NOT NULL,     -- event name: session_start, run_end, research_start, ad, iap, funnel, ...
  props TEXT,              -- JSON object of small numbers / short strings / booleans
  t     INTEGER,           -- event time, ms (device clock, clamped to the last 30 days)
  day   TEXT,              -- UTC day of t, YYYY-MM-DD
  plat  TEXT,              -- ios | web | other
  app   TEXT,              -- marketing version
  build TEXT,              -- TestFlight / App Store build number
  recv  INTEGER            -- time the Worker received it, ms
);
CREATE INDEX IF NOT EXISTS events_name_day ON events (name, day);
CREATE INDEX IF NOT EXISTS events_iid ON events (iid);
CREATE INDEX IF NOT EXISTS events_day ON events (day);

-- Spike-only: dummy table to prove the D1 binding + server function round-trip.
-- Not part of the real projects schema; drop this migration when the spike is done.
CREATE TABLE pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

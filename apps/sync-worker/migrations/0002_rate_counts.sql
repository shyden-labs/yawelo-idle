-- Request counts for the route limits (#164 AC2, AC5; spec §12.9), kept in
-- D1 so every isolate and location shares one exact count (Shyden,
-- 2026-11-18). `key` is a keyed one-way hash of the caller's network (an
-- IPv4 /24 or IPv6 /64), never the address (Shyden, 2026-11-19). A row is
-- deleted by the first request after `window_end` (Unix seconds), with no
-- scheduled job (Shyden, 2026-11-19).
CREATE TABLE rate_counts (
  route TEXT NOT NULL,
  key TEXT NOT NULL,
  window_end INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (route, key, window_end)
) WITHOUT ROWID;

-- Player content reports (#52, design docs/superpowers/specs/
-- 2026-10-02-content-reports-design.md §B.3). Times are Unix milliseconds.
-- No personal data: no IP, user agent, name or email is stored. Resolving a
-- report deletes its row; "Delete my data" deletes an install's reports and
-- quota rows.

CREATE TABLE content_reports (
  id TEXT NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL,
  course TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  problem TEXT NOT NULL,
  suggestion TEXT,
  note TEXT,
  app_version TEXT NOT NULL,
  content_version TEXT NOT NULL,
  install_id TEXT NOT NULL
);

-- The operator queue reads oldest first (§B.4).
CREATE INDEX content_reports_created ON content_reports (created_at);

-- One open report per install per item, held under concurrency by the index
-- itself (§B.2).
CREATE UNIQUE INDEX content_reports_one_per_item
  ON content_reports (install_id, course, kind, item_id);

-- The day's count per install, kept apart from the reports because resolving
-- a report deletes its row: a count of stored rows would let a quickly
-- triaged install send more than ten a day (§B.2). The CHECK refuses the
-- 11th, which rolls back the report's whole D1 batch.
CREATE TABLE content_report_quota (
  install_id TEXT NOT NULL,
  utc_day TEXT NOT NULL,
  n INTEGER NOT NULL
    CONSTRAINT content_report_daily_limit CHECK (n BETWEEN 1 AND 10),
  PRIMARY KEY (install_id, utc_day)
);

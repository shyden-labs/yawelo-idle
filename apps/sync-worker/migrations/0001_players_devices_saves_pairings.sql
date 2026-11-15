-- The first server tables (#162, spec §6.6 and §6.7). Times are Unix
-- milliseconds. Every row belongs to a player and goes with them: "Delete my
-- data" (#174) deletes the player row and the foreign keys cascade.

-- An anonymous player: no name, no email, no login (spec D6).
CREATE TABLE players (
  id TEXT NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- One row per registered device. The device token is never stored: only its
-- SHA-256 (32 bytes), which the Worker looks up by (spec §6.6).
CREATE TABLE devices (
  id TEXT NOT NULL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  token_hash BLOB NOT NULL UNIQUE
    CHECK (typeof(token_hash) = 'blob' AND length(token_hash) = 32),
  name TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX devices_player_id ON devices (player_id);

-- One save per player and course; `version` is the current one, and it only
-- ever rises (spec §6.6).
CREATE TABLE saves (
  id TEXT NOT NULL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  course TEXT NOT NULL CHECK (course IN ('en-id', 'id-en')),
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at INTEGER NOT NULL,
  UNIQUE (player_id, course)
);

-- The ciphertext of each version (AES-256-GCM under the player's key K, which
-- never reaches this table), the last five kept per save.
CREATE TABLE save_versions (
  save_id TEXT NOT NULL REFERENCES saves (id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  ciphertext BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (save_id, version)
);

-- The sixth version evicts the oldest inside the insert's own statement, so
-- no reader ever sees six.
CREATE TRIGGER save_versions_keep_five
AFTER INSERT ON save_versions
BEGIN
  DELETE FROM save_versions
  WHERE save_id = NEW.save_id
    AND version NOT IN (
      SELECT version FROM save_versions
      WHERE save_id = NEW.save_id
      ORDER BY version DESC
      LIMIT 5
    );
END;

-- A one-time pairing (spec §6.6). `secret_hash` is the SHA-256 of the QR's
-- token or of the 6-digit code. Only a code pairing carries the save key K,
-- for at most 10 minutes and 5 claim attempts; a QR pairing never does.
CREATE TABLE pairings (
  id TEXT NOT NULL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('qr', 'code')),
  secret_hash BLOB NOT NULL UNIQUE
    CHECK (typeof(secret_hash) = 'blob' AND length(secret_hash) = 32),
  save_key BLOB CHECK (
    (kind = 'qr' AND save_key IS NULL)
    OR (kind = 'code' AND typeof(save_key) = 'blob' AND length(save_key) = 32)
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX pairings_player_id ON pairings (player_id);
CREATE INDEX pairings_expires_at ON pairings (expires_at);

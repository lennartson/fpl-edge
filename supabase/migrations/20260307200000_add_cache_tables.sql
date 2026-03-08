-- Cache metadata: tracks when each cached dataset was last fetched and when it expires
CREATE TABLE IF NOT EXISTS cache_metadata (
  key text PRIMARY KEY,
  last_updated timestamp,
  expires_at timestamp
);

-- Team picks cache: stores per-user per-gameweek squad picks
CREATE TABLE IF NOT EXISTS team_picks_cache (
  team_id int PRIMARY KEY,
  gameweek int,
  picks jsonb,
  cached_at timestamp,
  expires_at timestamp
);

-- Live gameweek cache: stores live scoring data with TTL depending on match status
CREATE TABLE IF NOT EXISTS live_gameweek_cache (
  gameweek int PRIMARY KEY,
  data jsonb,
  cached_at timestamp,
  expires_at timestamp
);

-- RLS: all three cache tables are read-only from the frontend
ALTER TABLE cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_picks_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_gameweek_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read cache_metadata"     ON cache_metadata     FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read team_picks_cache"   ON team_picks_cache   FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read live_gameweek_cache" ON live_gameweek_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

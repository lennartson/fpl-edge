-- Fix team_picks_cache to use composite primary key (team_id, gameweek)
-- so multiple gameweeks per team can be cached independently.
DROP TABLE IF EXISTS team_picks_cache;

CREATE TABLE team_picks_cache (
  team_id  int,
  gameweek int,
  picks    jsonb,
  cached_at  timestamp,
  expires_at timestamp,
  PRIMARY KEY (team_id, gameweek)
);

ALTER TABLE team_picks_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read team_picks_cache" ON team_picks_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

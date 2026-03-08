CREATE TABLE IF NOT EXISTS team_cache (
  team_id    int PRIMARY KEY,
  data       jsonb,
  cached_at  timestamp,
  expires_at timestamp
);

CREATE TABLE IF NOT EXISTS mini_league_cache (
  league_id  int,
  gameweek   int,
  data       jsonb,
  cached_at  timestamp,
  expires_at timestamp,
  PRIMARY KEY (league_id, gameweek)
);

CREATE TABLE IF NOT EXISTS top_managers_cache (
  gameweek   int PRIMARY KEY,
  data       jsonb,
  cached_at  timestamp,
  expires_at timestamp
);

ALTER TABLE team_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_league_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_managers_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read team_cache" ON team_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read mini_league_cache" ON mini_league_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read top_managers_cache" ON top_managers_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

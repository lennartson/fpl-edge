-- FPL Edge initial schema

CREATE TABLE IF NOT EXISTS teams (
  id int PRIMARY KEY,
  name text,
  short_name text
);

CREATE TABLE IF NOT EXISTS players (
  id int PRIMARY KEY,
  web_name text,
  full_name text,
  team_id int REFERENCES teams(id),
  position int,  -- 1=GK, 2=DEF, 3=MID, 4=FWD
  price numeric,
  total_points int,
  form numeric,
  ict_index numeric,
  selected_by_percent numeric,
  minutes int,
  goals_scored int,
  assists int,
  clean_sheets int,
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gameweeks (
  id int PRIMARY KEY,
  name text,
  deadline_time timestamp,
  is_current boolean DEFAULT false,
  is_next boolean DEFAULT false,
  finished boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS fixtures (
  id int PRIMARY KEY,
  gameweek int REFERENCES gameweeks(id),
  home_team_id int REFERENCES teams(id),
  away_team_id int REFERENCES teams(id),
  fdr_home int,
  fdr_away int,
  kickoff_time timestamp,
  finished boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS user_preferences (
  team_id int PRIMARY KEY,
  email text,
  created_at timestamp DEFAULT now()
);

-- Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE gameweeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read players"          ON players          FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read teams"            ON teams            FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read fixtures"         ON fixtures         FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read gameweeks"        ON gameweeks        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read user_preferences" ON user_preferences FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

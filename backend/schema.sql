CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY CHECK (char_length(user_id) BETWEEN 1 AND 128),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
  nickname TEXT CHECK (nickname IS NULL OR char_length(nickname) <= 40),
  age_group TEXT NOT NULL,
  country TEXT NOT NULL CHECK (char_length(country) BETWEEN 1 AND 60),
  city TEXT NOT NULL CHECK (char_length(city) BETWEEN 1 AND 80),
  gender TEXT NOT NULL,
  primary_position TEXT NOT NULL,
  preferred_foot TEXT NOT NULL,
  playing_level TEXT NOT NULL,
  years_playing TEXT NOT NULL,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 200),
  playing_style TEXT[] NOT NULL DEFAULT '{}',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  ambitions TEXT CHECK (ambitions IS NULL OR char_length(ambitions) <= 320),
  languages TEXT[] NOT NULL DEFAULT '{}',
  avatar_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS avatar_key TEXT;

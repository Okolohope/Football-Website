CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY CHECK (char_length(user_id) BETWEEN 1 AND 128),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
  nickname TEXT CHECK (nickname IS NULL OR char_length(nickname) <= 40),
  date_of_birth DATE,
  phone_number TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_consent BOOLEAN NOT NULL DEFAULT FALSE,
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
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- Social posts and media
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  caption TEXT NOT NULL CHECK (char_length(caption) <= 1000),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id);

CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  object_key TEXT NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 300)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments(post_id, created_at);

-- TikTok-style following
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- Teams and persistent player career records
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'player',
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX IF NOT EXISTS squad_memberships_player_idx ON squad_memberships(player_id);
CREATE UNIQUE INDEX IF NOT EXISTS squad_active_membership_idx
  ON squad_memberships(player_id, team_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  clean_sheets INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(4,2),
  man_of_the_match INTEGER NOT NULL DEFAULT 0,
  season TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Minor safety and advertising controls
CREATE TABLE IF NOT EXISTS guardian_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  consented_at TIMESTAMPTZ,
  consent_method TEXT CHECK (consent_method IN ('email', 'phone', 'in_person')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eleven identity and squad model
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  player_uuid TEXT NOT NULL UNIQUE CHECK (player_uuid ~ '^ELE[0-9]{4,5}$'),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  position TEXT,
  dark_mode BOOLEAN NOT NULL DEFAULT TRUE,
  stats_privacy TEXT NOT NULL DEFAULT 'EVERYONE'
    CHECK (stats_privacy IN ('EVERYONE', 'SQUAD_ONLY', 'FRIENDS_ONLY')),
  followers_count BIGINT NOT NULL DEFAULT 0,
  following_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS user_follows_following_created_idx
  ON user_follows(following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_follows_follower_created_idx
  ON user_follows(follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_code TEXT NOT NULL UNIQUE CHECK (squad_code ~ '^SE-[0-9]{4}$'),
  name TEXT NOT NULL,
  squad_category TEXT NOT NULL CHECK (squad_category IN ('REGULATED_CLUB', 'UNIVERSITY_SCHOOL')),
  region_state TEXT,
  coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS squads_name_idx ON squads USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS squads_category_idx ON squads(squad_category);

CREATE TABLE IF NOT EXISTS squad_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'PLAYER'
    CHECK (role IN ('PLAYER', 'CAPTAIN', 'ASSISTANT_COACH', 'COACH')),
  membership_type TEXT NOT NULL
    CHECK (membership_type IN ('PRIMARY', 'LOAN', 'UNIVERSITY')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ENDED')),
  is_top_eleven BOOLEAN NOT NULL DEFAULT FALSE,
  loan_end_date DATE,
  parent_squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS squad_membership_one_active_primary
  ON squad_memberships(user_id) WHERE membership_type = 'PRIMARY' AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS squad_membership_one_active_loan
  ON squad_memberships(user_id) WHERE membership_type = 'LOAN' AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS squad_membership_one_active_university
  ON squad_memberships(user_id) WHERE membership_type = 'UNIVERSITY' AND status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS squad_memberships_user_status_idx
  ON squad_memberships(user_id, status, joined_at DESC);

CREATE TABLE IF NOT EXISTS squad_transfer_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  to_squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL
    CHECK (offer_type IN ('INVITE', 'LOAN', 'PERMANENT_TRANSFER', 'UNIVERSITY_INVITE')),
  loan_end_date DATE,
  player_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (player_status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  parent_coach_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (parent_coach_status IN ('PENDING', 'APPROVED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_match_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  match_id TEXT,
  matches_played INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(4,2),
  coach_notes TEXT,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_match_ratings_player_squad_idx
  ON player_match_ratings(player_id, squad_id, played_at DESC);

CREATE TABLE IF NOT EXISTS career_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  membership_type TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  matches INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(4,2)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS training_sessions_squad_starts_idx
  ON training_sessions(squad_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_rsvp TEXT NOT NULL DEFAULT 'NOT_RESPONDED'
    CHECK (player_rsvp IN ('ATTENDING', 'RUNNING_LATE', 'NOT_ATTENDING', 'NOT_RESPONDED')),
  player_reason TEXT,
  rsvp_updated_at TIMESTAMPTZ,
  coach_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (coach_status IN ('UNVERIFIED', 'VERIFIED_PRESENT', 'VERIFIED_LATE', 'VERIFIED_ABSENT')),
  verified_by_coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS training_attendance_session_coach_idx
  ON training_attendance(session_id, coach_status);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT
  CHECK (post_type IN ('CLIP', 'STANDARD'));
UPDATE posts SET post_type = 'STANDARD' WHERE post_type IS NULL;
ALTER TABLE posts ALTER COLUMN post_type SET NOT NULL;
ALTER TABLE posts ALTER COLUMN post_type SET DEFAULT 'STANDARD';

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('DIRECT', 'SQUAD_GROUP')),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (viewer_id <> viewed_user_id)
);
CREATE INDEX IF NOT EXISTS profile_views_user_created_idx
  ON profile_views(viewed_user_id, created_at DESC);

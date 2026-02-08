-- CALL IT Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  callit_score DECIMAL(10, 2) DEFAULT 0,
  tier TEXT DEFAULT 'Bronze',
  total_calls INTEGER DEFAULT 0,
  won_calls INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  onchain_id TEXT UNIQUE,
  caller TEXT NOT NULL,
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  deadline BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  resolved_at BIGINT,
  total_challengers INTEGER DEFAULT 0,
  total_stake TEXT DEFAULT '0'
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id),
  challenger TEXT NOT NULL,
  stake TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Events table (for indexer)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('CallCreated', 'CallChallenged', 'CallResolved', 'CallAutoRefunded')),
  call_id TEXT REFERENCES calls(id),
  challenge_id TEXT REFERENCES challenges(id),
  user_address TEXT NOT NULL,
  data JSONB NOT NULL,
  signature TEXT UNIQUE NOT NULL,
  slot BIGINT NOT NULL,
  timestamp BIGINT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_deadline ON calls(deadline);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_call_id ON challenges(call_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_slot ON events(slot DESC);
CREATE INDEX IF NOT EXISTS idx_users_score ON users(callit_score DESC);

-- CALL IT Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  callit_score DECIMAL(10, 2) DEFAULT 0,
  tier INTEGER DEFAULT 1,
  total_calls INTEGER DEFAULT 0,
  won_calls INTEGER DEFAULT 0,
  lost_calls INTEGER DEFAULT 0,
  total_challenged INTEGER DEFAULT 0,
  won_challenges INTEGER DEFAULT 0,
  lost_challenges INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  onchain_id TEXT UNIQUE NOT NULL,
  caller TEXT NOT NULL REFERENCES users(wallet_address),
  caller_address TEXT NOT NULL,
  claim TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('TokenPrice', 'RugPrediction')),
  token_address TEXT,
  target_price DECIMAL(20, 8),
  creation_price DECIMAL(20, 8),
  stake BIGINT NOT NULL,
  confidence INTEGER NOT NULL,
  deadline BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'ResolvedCallerWins', 'ResolvedCallerLoses', 'AutoRefunded')),
  challengers_count INTEGER DEFAULT 0,
  resolved_at BIGINT
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  onchain_id TEXT UNIQUE NOT NULL,
  call_id TEXT NOT NULL REFERENCES calls(id),
  challenger TEXT NOT NULL REFERENCES users(wallet_address),
  challenger_address TEXT NOT NULL,
  stake BIGINT NOT NULL,
  confidence INTEGER NOT NULL,
  created_at BIGINT NOT NULL
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

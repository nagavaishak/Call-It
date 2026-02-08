# CALL IT - Backend API

🔧 Backend API and blockchain indexer for CALL IT protocol

## Features

- ✅ **REST API** - Full CRUD operations for calls, challenges, users
- ✅ **Blockchain Indexer** - Real-time event monitoring from Solana
- ✅ **PostgreSQL Database** - Relational data storage
- ✅ **Oracle Integration** - Pending calls endpoint for oracle nodes
- ✅ **Leaderboard** - Top users by CALL IT score

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Caching:** Redis (optional)
- **Blockchain:** Solana Web3.js + Anchor

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/callit
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
```

### 3. Setup Database

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL
brew install postgresql@16  # macOS
# or
sudo apt install postgresql  # Linux

# Create database
createdb callit

# Initialize schema
npm run db:setup
```

**Option B: Supabase (Recommended)**
1. Create account at https://supabase.com
2. Create new project
3. Copy connection string to `.env`
4. Run migrations in Supabase SQL Editor (paste `src/db/schema.sql`)

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Start Indexer (Separate Process)

```bash
npm run indexer
```

## API Endpoints

### Calls

**GET /api/calls**
- Get all calls with pagination
- Query params: `limit`, `offset`, `status`

```bash
curl http://localhost:4000/api/calls?limit=10&status=Active
```

**GET /api/calls/:id**
- Get call by ID

```bash
curl http://localhost:4000/api/calls/call_abc123
```

**GET /api/calls/:id/challenges**
- Get all challenges for a call

```bash
curl http://localhost:4000/api/calls/call_abc123/challenges
```

### Users

**GET /api/users/:wallet**
- Get user profile

```bash
curl http://localhost:4000/api/users/BkZPVAfARRCdLd6i7a1bf2RTShJBBqidSfqZtj1V32mJ
```

**GET /api/users/:wallet/calls**
- Get user's calls

**GET /api/users/:wallet/challenges**
- Get user's challenges

**GET /api/users/leaderboard**
- Get top users by score

```bash
curl http://localhost:4000/api/users/leaderboard?limit=50
```

### Oracle (Internal)

**GET /api/oracle/pending-calls**
- Get calls ready for resolution
- Used by oracle nodes

```bash
curl http://localhost:4000/api/oracle/pending-calls
```

## Database Schema

See `src/db/schema.sql` for complete schema.

**Tables:**
- `users` - User profiles and stats
- `calls` - All prediction calls
- `challenges` - Challenges to calls
- `events` - Blockchain events log

## Indexer Service

The indexer monitors the Solana blockchain for program events:

1. Subscribes to program logs
2. Parses events (CallCreated, CallChallenged, etc.)
3. Syncs data to PostgreSQL
4. Periodic backfill of recent transactions

**Events Indexed:**
- `CallCreated` - New call made
- `CallChallenged` - Call challenged
- `CallResolved` - Oracle resolved call
- `CallAutoRefunded` - Auto-refund triggered

## Development

### Run Tests
```bash
npm test
```

### Check Database
```bash
psql $DATABASE_URL
\dt  # List tables
SELECT * FROM calls LIMIT 10;
```

### Monitor Logs
```bash
# API logs
npm run dev

# Indexer logs
npm run indexer
```

## Deployment

### Production Checklist

- [ ] Set up PostgreSQL (Supabase recommended)
- [ ] Configure environment variables
- [ ] Set up Redis for caching (optional)
- [ ] Deploy API server (Railway/Fly.io/AWS)
- [ ] Deploy indexer as separate service
- [ ] Set up monitoring (Better Stack)
- [ ] Configure CORS for production domain

### Recommended Services

**Database:** Supabase (free tier: 500MB, 2GB transfer/month)
**API Hosting:** Railway / Fly.io / Render
**Caching:** Upstash Redis
**Monitoring:** Better Stack / Sentry

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL
```

### Indexer Not Syncing

```bash
# Check RPC connection
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Verify program ID
solana program show 3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A --url devnet
```

## License

MIT

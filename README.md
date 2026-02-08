# CALL IT

🎯 **Reputation Staking Protocol on Solana**

Put your money where your mouth is. Stake SOL on predictions, challenge others, and build your on-chain reputation.

## Overview

CALL IT is a decentralized reputation staking protocol that allows users to:
- Make public predictions by staking SOL
- Challenge calls they disagree with
- Build on-chain reputation through accurate predictions
- Earn rewards from successful calls

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Solana    │
│  (Next.js)  │     │   (Node.js) │     │  Blockchain │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Oracle    │
                    │  (Node.js)  │
                    └─────────────┘
```

## Components

### 1. Smart Contract (`callit/`)
Solana program built with Anchor Framework
- **Program ID:** `3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A`
- **Network:** Devnet
- **Features:**
  - Make calls with SOL stakes
  - Challenge mechanism with confidence levels
  - Oracle-based resolution
  - Automatic refunds for unchallenged calls
  - Bounded 1.5x payouts with dust handling

[Smart Contract README](./callit/README.md)

### 2. Oracle Service (`oracle-service/`)
Off-chain oracle for call resolution
- **Features:**
  - 2-of-3 multisig consensus
  - Deterministic leader election
  - Price oracle (DexScreener + Jupiter)
  - Rug detection
  - Wallet identity verification

[Oracle README](./oracle-service/README.md)

### 3. Backend API (`backend/`)
REST API and blockchain indexer
- **Features:**
  - PostgreSQL database
  - Real-time blockchain event monitoring
  - Call/user/challenge CRUD operations
  - Leaderboard system
  - Oracle integration endpoints

[Backend README](./backend/README.md)

### 4. Frontend (`frontend/`)
Next.js web application
- **Features:**
  - Solana wallet integration
  - Call creation and challenging UI
  - Leaderboard and user profiles
  - Real-time updates

[Frontend README](./frontend/README.md)

## Quick Start

### Prerequisites
- Node.js 18+
- Solana CLI
- PostgreSQL (or Supabase account)
- Phantom wallet (for testing)

### 1. Smart Contract

```bash
cd callit
npm install
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Oracle Service

```bash
cd oracle-service
npm install
cp .env.example .env
# Edit .env with your config
npm run dev
```

### 3. Backend API

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with database URL
npm run dev

# In separate terminal
npm run indexer
```

### 4. Frontend

```bash
cd frontend
npm install
# .env.local already created
npm run dev
```

Open http://localhost:3000

## Development Flow

1. **User makes a call** (Frontend → Smart Contract)
   - Connects wallet
   - Stakes SOL on prediction
   - Transaction confirmed on-chain

2. **Call indexed** (Blockchain → Backend)
   - Indexer detects CallCreated event
   - Stores in PostgreSQL
   - Available via API

3. **Others challenge** (Frontend → Smart Contract)
   - Users stake against the call
   - Confidence level recorded
   - Challenge stored on-chain

4. **Oracle resolves** (Oracle → Smart Contract)
   - 2-of-3 consensus mechanism
   - Validates call outcome
   - Submits resolution transaction

5. **Payouts distributed** (Smart Contract)
   - Winners receive 1.5x stake
   - Losers forfeit their stake
   - User scores updated

## Tech Stack

| Component | Technologies |
|-----------|-------------|
| Smart Contract | Rust, Anchor, Solana |
| Oracle | Node.js, TypeScript, DexScreener, Jupiter |
| Backend | Node.js, Express, PostgreSQL, Redis |
| Frontend | Next.js, React, Tailwind CSS, Wallet Adapter |
| Blockchain | Solana (Devnet) |

## Key Features

### Reputation System
- **CALL IT Score**: Weighted score based on call accuracy
- **Tiers**: Bronze → Silver → Gold → Platinum → Diamond
- **Streaks**: Consecutive wins tracked on-chain

### Economic Model
- **Fixed 1.5x Payouts**: Winners get 1.5x their stake
- **Dust Handling**: Remainder stays in escrow
- **No Protocol Fees**: All value flows to participants

### Security
- **Ed25519 Signatures**: Oracle attestations verified on-chain
- **2-of-3 Consensus**: Requires majority oracle agreement
- **Escrow PDAs**: Funds held securely in program-derived addresses

## Deployment

### Smart Contract
Already deployed on Solana Devnet:
```
Program ID: 3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
```

### Backend & Oracle
Recommended services:
- **Database**: Supabase (free tier)
- **API/Oracle**: Railway, Fly.io, Render
- **Monitoring**: Better Stack, Sentry

### Frontend
Recommended platforms:
- **Vercel** (recommended)
- Netlify
- AWS Amplify

## Project Status

- ✅ Phase 1: Smart Contract (COMPLETE)
- ✅ Phase 2: Oracle Service (COMPLETE)
- ✅ Phase 2: Backend API (COMPLETE)
- ✅ Phase 2: Frontend (COMPLETE)
- ⏳ Phase 3: Testing & Polish
- ⏳ Phase 4: Mainnet Deployment

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

## Support

For issues or questions:
- Open a GitHub issue
- Check component-specific READMEs
- Review architecture docs in `/docs`

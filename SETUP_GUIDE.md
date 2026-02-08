# CALL IT - Complete Setup Guide

## Prerequisites
- Node.js 18+ installed
- Phantom wallet browser extension
- Supabase account (free)

## Part 1: Database Setup (Supabase)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up or log in
3. Click **"New Project"**
   - **Name:** callit
   - **Database Password:** (choose a strong password - save it!)
   - **Region:** (select closest to you)
   - Click **"Create new project"**
   - Wait ~2 minutes for provisioning

### Step 2: Get Connection String
1. Once project is ready, go to **Settings** (gear icon) → **Database**
2. Scroll to **"Connection string"** section
3. Select **"URI"** tab
4. Copy the connection string (looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. **Important:** Replace `[YOUR-PASSWORD]` with your actual password

### Step 3: Initialize Database Schema
1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file: `backend/src/db/schema.sql` on your computer
4. Copy all the SQL code
5. Paste into Supabase SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see: "Success. No rows returned"

## Part 2: Backend Setup

### Step 1: Configure Environment
```bash
cd backend
cp .env.example .env
```

Edit `.env` file and update:
```bash
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
CORS_ORIGIN=*
```

### Step 2: Start Backend API
```bash
npm run dev
```

You should see:
```
🚀 CALL IT Backend API running on port 4000
📍 Health check: http://localhost:4000/health
```

Test it: http://localhost:4000/health

### Step 3: Start Indexer (New Terminal)
```bash
cd backend
npm run indexer
```

You should see:
```
🔍 CALL IT Indexer started
📡 Monitoring program: 3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
```

## Part 3: Oracle Setup (Optional for now)

```bash
cd oracle-service
cp .env.example .env
```

Edit `.env`:
```bash
NODE_ID=1
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
ORACLE_KEYPAIR=path/to/keypair.json
```

Start oracle:
```bash
npm run dev
```

## Part 4: Frontend Setup

### Step 1: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 2: Open Browser
Go to: http://localhost:3000

### Step 3: Connect Wallet
1. Click **"Connect Wallet"** in top right
2. Select **Phantom** (or Solflare)
3. Approve connection
4. **Important:** Switch wallet to **Devnet**:
   - Open Phantom → Settings → Network → Devnet

### Step 4: Get Test SOL
```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

Or use: https://faucet.solana.com

## Testing the Complete Flow

### 1. Make a Call
1. Click **"+ Make Call"**
2. Fill in:
   - Description: "SOL will hit $200 by March 2026"
   - Stake: 0.1
   - Deadline: 24 hours
3. Click **"Create Call"**
4. Approve transaction in Phantom
5. Wait for confirmation

### 2. View Call
- After 5-10 seconds, your call should appear on homepage
- Click on it to see details

### 3. Challenge a Call (Use Different Wallet)
1. Switch to different wallet OR use different browser/incognito
2. Click on a call
3. Click **"Challenge This Call"**
4. Fill in:
   - Stake: 0.1
   - Confidence: 75%
5. Approve transaction
6. Challenge appears in call details

### 4. Check Leaderboard
- Click **"Leaderboard"** in navbar
- Your wallet should appear with stats

### 5. View Profile
- Click on your wallet address
- See your calls and challenges

## Troubleshooting

### Database Connection Failed
- Verify DATABASE_URL is correct
- Check Supabase project is running
- Ensure password has no special characters that need escaping

### Wallet Not Connecting
- Install Phantom extension
- Refresh page
- Try incognito mode

### Transaction Failed
- Ensure wallet is on **Devnet**
- Check you have test SOL: `solana balance --url devnet`
- Airdrop more: `solana airdrop 2 --url devnet`

### Indexer Not Syncing
- Check RPC URL is correct
- Verify program ID matches deployed contract
- Check console for errors

### Call Not Appearing
- Wait 10-15 seconds for indexer to process
- Check backend logs for errors
- Refresh browser page

## Services Overview

| Service | Port | URL | Status Check |
|---------|------|-----|--------------|
| Frontend | 3000 | http://localhost:3000 | Open in browser |
| Backend API | 4000 | http://localhost:4000/health | Should return `{"status":"ok"}` |
| Indexer | - | - | Check terminal logs |
| Oracle | - | - | Optional for testing |

## Next Steps

1. ✅ Set up all services
2. ✅ Make your first call
3. ✅ Challenge someone's call
4. Test oracle resolution (requires 3 oracle nodes)
5. Check leaderboard rankings
6. Build reputation!

## Need Help?

- Check component READMEs in each directory
- Review error messages in terminal
- Check browser console (F12)
- Verify all environment variables are set correctly

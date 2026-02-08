# CALL IT - Frontend

🎨 Next.js frontend for CALL IT reputation staking protocol

## Features

- ✅ **Solana Wallet Integration** - Phantom, Solflare support
- ✅ **Call Creation** - Create predictions with SOL stakes
- ✅ **Challenge Interface** - Challenge calls with confidence levels
- ✅ **Leaderboard** - Top users by CALL IT score
- ✅ **User Profiles** - View stats, calls, and challenges
- ✅ **Real-time Updates** - Live call status and challenges

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Wallet:** Solana Wallet Adapter
- **Blockchain:** @solana/web3.js + Anchor

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` file:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Build

```bash
npm run build
npm start
```

## Pages

### Home (`/`)
- View active calls
- Create new calls
- Filter by status

### Call Detail (`/call/[id]`)
- View call details
- Submit challenges
- See all challengers

### Leaderboard (`/leaderboard`)
- Top 100 users
- Sort by CALL IT score
- View stats: win rate, streak, tier

### User Profile (`/user/[wallet]`)
- User statistics
- All user calls
- All user challenges

## Components

### `WalletProvider.tsx`
Wraps app with Solana wallet context

### `Navbar.tsx`
Navigation bar with wallet connect button

## API Integration

The frontend communicates with:
1. **Backend API** (port 4000) - Call/user data
2. **Solana RPC** (devnet) - Blockchain interactions

## Wallet Connection

Supported wallets:
- Phantom
- Solflare
- Any Solana wallet adapter compatible wallet

## Smart Contract Interaction

### Make Call
```typescript
const result = await makeCall(
  connection,
  wallet,
  "SOL will hit $200",
  1.5, // SOL amount
  24   // hours
);
```

### Challenge Call
```typescript
const tx = await challengeCall(
  connection,
  wallet,
  callPubkey,
  1.0,  // SOL amount
  75    // confidence %
);
```

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Environment Variables
Set in Vercel dashboard:
- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `NEXT_PUBLIC_PROGRAM_ID`
- `NEXT_PUBLIC_API_URL`

### Other Platforms
- Netlify
- Railway
- AWS Amplify

## Development Tips

### Run with Backend
Ensure backend API is running on port 4000:
```bash
cd ../backend
npm run dev
```

### Run with Indexer
For real-time updates:
```bash
cd ../backend
npm run indexer
```

### Wallet Setup
1. Install Phantom wallet extension
2. Switch to Devnet in settings
3. Get test SOL from faucet: `solana airdrop 2`

## Troubleshooting

### Wallet Not Connecting
- Ensure wallet extension is installed
- Switch wallet to Devnet
- Refresh page

### Transaction Failures
- Check wallet has enough SOL
- Verify RPC endpoint is responsive
- Check browser console for errors

### API Connection Issues
- Ensure backend is running on port 4000
- Check CORS settings in backend
- Verify API URL in .env.local

## License

MIT

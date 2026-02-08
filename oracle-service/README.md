# CALL IT - Oracle Service

🔮 Decentralized oracle network for CALL IT protocol

## Features

- ✅ **2-of-3 Multisig Consensus** - Requires agreement from 2 out of 3 oracle nodes
- ✅ **Deterministic Leader Election** - Hash-based leader selection (no timestamp)
- ✅ **Ed25519 Signature Verification** - On-chain signature validation
- ✅ **Price Oracle Integration** - DexScreener + Jupiter consensus pricing
- ✅ **Rug Detection** - Multi-factor rug pull detection (2 of 3 conditions)
- ✅ **Automatic Failover** - Backup nodes take over if leader fails

## Architecture

### Components

1. **Oracle Node** (`src/index.ts`)
   - Runs cron job to check pending resolutions
   - Implements deterministic leader election
   - Coordinates with peer nodes
   - Submits resolution transactions

2. **Price Oracle** (`src/services/priceOracle.ts`)
   - Fetches prices from multiple sources
   - Calculates consensus median price
   - Validates price targets

3. **Rug Detector** (`src/services/rugDetector.ts`)
   - Checks price collapse (>80% drop sustained 12h)
   - Analyzes top holder activity
   - Detects liquidity removal

4. **Coordinator** (`src/services/coordinator.ts`)
   - Validates calls independently
   - Requests peer validations
   - Generates Ed25519 signatures
   - Ensures 2-of-3 consensus

5. **Blockchain Resolver** (`src/services/resolver.ts`)
   - Builds resolution transactions
   - Creates Ed25519 SigVerify instructions
   - Submits to Solana blockchain

## Setup

### 1. Generate Oracle Keypairs

```bash
npm install
npm run generate-keys
```

This creates:
- `oracle-node-1.json`
- `oracle-node-2.json`
- `oracle-node-3.json`
- `oracle-public-keys.json` (for contract initialization)

### 2. Initialize Smart Contract

Use the public keys from `oracle-public-keys.json` to initialize the protocol:

```bash
cd ../callit
anchor run initialize-protocol -- --oracle-keys oracle-public-keys.json
```

### 3. Configure Environment

Create `.env` files for each node:

**Node 1** (`.env.node1`):
```bash
NODE_ID=1
ORACLE_SECRET_KEY=[...from oracle-node-1.json...]
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A
PEER_1_URL=http://localhost:3001
PEER_2_URL=http://localhost:3002
BACKEND_URL=http://localhost:4000
PORT=3000
```

**Node 2** (`.env.node2`):
```bash
NODE_ID=2
ORACLE_SECRET_KEY=[...from oracle-node-2.json...]
# ... same as Node 1, change PORT to 3001
```

**Node 3** (`.env.node3`):
```bash
NODE_ID=3
ORACLE_SECRET_KEY=[...from oracle-node-3.json...]
# ... same as Node 1, change PORT to 3002
```

### 4. Run Oracle Nodes

**Local testing (3 terminals)**:
```bash
# Terminal 1
npm run start:node1

# Terminal 2
npm run start:node2

# Terminal 3
npm run start:node3
```

**Production (3 separate servers)**:
```bash
# On each server
npm run build
npm start
```

## How It Works

### 1. Leader Election

```typescript
// Deterministic: same call ID always produces same leader
const hash = sha256(callId);
const leaderIndex = hash[0] % 3; // 0, 1, or 2
```

- Hash of call ID determines leader
- No timestamp = deterministic across all nodes
- Same call always assigns same leader

### 2. Resolution Flow

```
1. Call deadline passes
2. Leader node detects pending call
3. Leader validates call independently
4. Leader requests validation from peers
5. Check consensus (2 of 3 must agree)
6. Generate Ed25519 signatures
7. Submit transaction with signatures
8. Smart contract verifies signatures on-chain
```

### 3. Backup Failover

- Non-leader nodes wait 5 minutes
- If leader hasn't resolved, backup takes over
- Backup selection is also deterministic (different hash)

### 4. 2-of-3 Consensus

**Price Calls:**
- Each oracle fetches price independently
- Validates against target
- 2 of 3 must agree on outcome

**Rug Calls:**
- Each oracle checks 3 conditions:
  1. Price collapse (>80% drop, sustained 12h)
  2. Top holders sold (>60% combined)
  3. Liquidity removed (<$1K)
- Need 2 of 3 conditions to confirm rug
- Then need 2 of 3 oracles to agree

## API Endpoints

### Health Check
```
GET /health
Response: { status: 'ok', nodeId: 1, publicKey: '...' }
```

### Validate Call (Peer Communication)
```
POST /api/validate
Body: { call: CallData }
Response: { validation: ValidationResult }
```

### Sign Resolution (Peer Communication)
```
POST /api/sign
Body: { callId: string, outcome: string, timestamp: number }
Response: { signature: OracleSignature }
```

## Testing

### Test Price Oracle
```typescript
import { PriceOracle } from './src/services/priceOracle';

const oracle = new PriceOracle();
const price = await oracle.getPrice('SOL_TOKEN_ADDRESS');
console.log(price);
```

### Test Rug Detection
```typescript
import { RugDetector } from './src/services/rugDetector';

const detector = new RugDetector(connection);
const result = await detector.detectRug('TOKEN_ADDRESS', createdAt);
console.log(result.isRug, result.reasons);
```

## Deployment

### Production Deployment

**Recommended Setup:**
- **Node 1:** AWS (us-east-1)
- **Node 2:** Hetzner (Europe)
- **Node 3:** DigitalOcean (Asia)

**Steps:**
1. Deploy to 3 separate servers
2. Configure environment variables
3. Set up monitoring (Better Stack)
4. Configure alerts (PagerDuty)
5. Set up logging (Sentry)

### Monitoring

**Key Metrics:**
- Resolution success rate
- Consensus failures
- Peer communication latency
- Transaction confirmation time
- Oracle uptime

**Alerts:**
- Consensus failure (2+ in 1 hour)
- Oracle node down (>5 minutes)
- Transaction failure (3+ consecutive)
- Peer communication timeout

## Security

### Private Key Management

**Development:**
- Keys stored in `.env` files
- Never commit to git (use `.gitignore`)

**Production:**
- Use AWS Secrets Manager
- Rotate keys quarterly
- Require 2FA for access

### Attack Prevention

✅ **Sybil Attack:** 2-of-3 consensus prevents single oracle manipulation
✅ **Price Manipulation:** Multi-source price consensus
✅ **Timestamp Gaming:** Deterministic leader election (no timestamp)
✅ **Replay Attack:** Each signature includes call ID + timestamp
✅ **Front-running:** Leader is determined before resolution

## Troubleshooting

### Consensus Failures

```bash
# Check oracle logs
Node 1: Price = $1.50, Outcome = CallerWins
Node 2: Price = $1.48, Outcome = CallerWins
Node 3: Price = $0.90, Outcome = CallerLoses
# Consensus: 2/3 agree = CallerWins
```

If consensus fails frequently:
- Check RPC connectivity
- Verify price API access
- Check peer communication

### Peer Communication Errors

```bash
# Test peer connectivity
curl http://node1:3000/health
curl http://node2:3001/health
curl http://node3:3002/health
```

### Transaction Failures

Common causes:
- Insufficient SOL for gas
- Program already resolved
- Invalid signature format
- Timeout during submission

## License

MIT

## Support

For issues or questions:
- GitHub Issues: https://github.com/nagavaishak/Call-It/issues
- Documentation: See `/docs` folder

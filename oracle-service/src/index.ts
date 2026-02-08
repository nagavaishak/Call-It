import { Connection, Keypair } from '@solana/web3.js';
import cron from 'node-cron';
import { createHash } from 'crypto';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { PriceOracle } from './services/priceOracle.js';
import { RugDetector } from './services/rugDetector.js';
import { OracleCoordinator } from './services/coordinator.js';
import { BlockchainResolver } from './services/resolver.js';
import { CallData } from './types/index.js';
import express from 'express';

dotenv.config();

/**
 * Oracle Node Service
 * Implements deterministic leader election and 2-of-3 consensus
 */
class OracleNode {
  private connection: Connection;
  private keypair: Keypair;
  private nodeId: number;
  private coordinator: OracleCoordinator;
  private resolver: BlockchainResolver;
  private submittedResolutions: Set<string> = new Set();
  private app: express.Application;

  constructor(nodeId: number) {
    this.nodeId = nodeId;

    // Load keypair from environment
    const secretKey = JSON.parse(process.env.ORACLE_SECRET_KEY!);
    this.keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    // Connect to Solana
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Initialize services
    const priceOracle = new PriceOracle();
    const rugDetector = new RugDetector(this.connection);

    this.coordinator = new OracleCoordinator(
      this.keypair,
      nodeId,
      [process.env.PEER_1_URL!, process.env.PEER_2_URL!].filter(u => u),
      priceOracle,
      rugDetector
    );

    this.resolver = new BlockchainResolver(
      this.connection,
      this.keypair,
      process.env.PROGRAM_ID!
    );

    // Set up API server for peer communication
    this.app = express();
    this.app.use(express.json());
    this.setupApiRoutes();
  }

  /**
   * Start the oracle node
   */
  start() {
    console.log(`🚀 Oracle Node ${this.nodeId} starting...`);
    console.log(`📍 Public key: ${this.keypair.publicKey.toString()}`);
    console.log(`🌐 RPC: ${process.env.SOLANA_RPC_URL}`);

    // Start API server
    const port = process.env.PORT || (3000 + this.nodeId - 1);
    this.app.listen(port, () => {
      console.log(`🔌 API server listening on port ${port}`);
    });

    // Schedule resolution checks every minute
    cron.schedule('* * * * *', async () => {
      await this.checkPendingResolutions();
    });

    console.log(`✅ Oracle Node ${this.nodeId} running`);
    console.log(`⏰ Checking for pending resolutions every minute`);
  }

  /**
   * Check for pending resolutions
   */
  private async checkPendingResolutions() {
    try {
      const pendingCalls = await this.fetchPendingCalls();
      const now = Math.floor(Date.now() / 1000);

      for (const call of pendingCalls) {
        if (now >= call.deadline) {
          // Deterministic leader election (FIX 12: no timestamp)
          const isLeader = this.isLeader(call.id);

          if (isLeader) {
            console.log(`👑 Node ${this.nodeId} is LEADER for call ${call.id}`);
            await this.resolveCall(call);
          } else {
            // Backups wait 5 minutes, then take over if leader failed
            const leaderGracePeriod = 300;
            if (now >= call.deadline + leaderGracePeriod) {
              const isBackup = this.isBackup(call.id);
              if (isBackup) {
                console.log(`⚠️  Leader timeout - Node ${this.nodeId} taking over for call ${call.id}`);
                await this.resolveCall(call);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in checkPendingResolutions:', error);
    }
  }

  /**
   * Deterministic leader election (hash ONLY call ID, no timestamp)
   */
  private isLeader(callId: string): boolean {
    const hash = createHash('sha256')
      .update(callId)
      .digest();

    const leaderIndex = hash[0] % 3; // 0, 1, or 2
    return leaderIndex + 1 === this.nodeId;
  }

  /**
   * Deterministic backup (different hash domain)
   */
  private isBackup(callId: string): boolean {
    const hash = createHash('sha256')
      .update(callId)
      .update('backup') // Add salt to get different hash
      .digest();

    const backupIndex = hash[0] % 3;
    return backupIndex + 1 === this.nodeId;
  }

  /**
   * Resolve a call
   */
  private async resolveCall(call: CallData) {
    const resolutionKey = `${call.id}-resolution`;

    if (this.submittedResolutions.has(resolutionKey)) {
      console.log(`Already submitted resolution for ${call.id}, skipping`);
      return;
    }

    console.log(`🎯 Node ${this.nodeId} resolving call ${call.id}...`);

    try {
      // Coordinate with peers (each validates independently)
      const signatures = await this.coordinator.coordinateResolution(call);

      if (!signatures || signatures.length < 2) {
        console.error(`❌ Failed to reach consensus for call ${call.id}`);
        return;
      }

      // Submit to blockchain
      const txSig = await this.resolver.submitResolution(call, signatures);

      if (txSig) {
        this.submittedResolutions.add(resolutionKey);

        // Cleanup old entries (keep last 1000)
        if (this.submittedResolutions.size > 1000) {
          const entries = Array.from(this.submittedResolutions);
          this.submittedResolutions = new Set(entries.slice(-1000));
        }

        console.log(`✅ Call ${call.id} resolved in tx: ${txSig}`);
      }
    } catch (error: any) {
      if (
        error.message?.includes('AlreadyResolved') ||
        error.message?.includes('CallNotActive')
      ) {
        console.log(`Call ${call.id} already resolved by another node`);
        this.submittedResolutions.add(resolutionKey);
        return;
      }

      console.error(`Failed to resolve call ${call.id}:`, error);
    }
  }

  /**
   * Fetch pending calls from backend
   */
  private async fetchPendingCalls(): Promise<CallData[]> {
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      const response = await axios.get(`${backendUrl}/api/oracle/pending-calls`);
      return response.data.calls || [];
    } catch (error) {
      console.error('Failed to fetch pending calls:', error);
      return [];
    }
  }

  /**
   * Set up API routes for peer communication
   */
  private setupApiRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        nodeId: this.nodeId,
        publicKey: this.keypair.publicKey.toString(),
      });
    });

    // Validation request from peer
    this.app.post('/api/validate', async (req, res) => {
      try {
        const { call } = req.body;
        const validation = await this.coordinator.handleValidationRequest(call);
        res.json({ validation });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Signature request from peer
    this.app.post('/api/sign', async (req, res) => {
      try {
        const { callId, outcome, timestamp } = req.body;
        const signature = await this.coordinator.handleSignatureRequest(
          callId,
          outcome,
          timestamp
        );

        res.json({
          signature: {
            signer: signature.signer.toString(),
            signature: Array.from(signature.signature),
            outcome: signature.outcome,
            timestamp: signature.timestamp,
          },
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}

// Start the oracle node
const NODE_ID = parseInt(process.env.NODE_ID || '1');
const oracle = new OracleNode(NODE_ID);
oracle.start();

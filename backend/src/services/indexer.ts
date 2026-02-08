import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { getDatabase } from '../db/database.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Blockchain Indexer Service
 * Monitors on-chain events and syncs to database
 */
export class Indexer {
  private connection: Connection;
  private programId: PublicKey;
  private db: ReturnType<typeof getDatabase>;
  private isRunning: boolean = false;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    this.programId = new PublicKey(process.env.PROGRAM_ID!);
    this.db = getDatabase();
  }

  /**
   * Start indexing
   */
  async start() {
    console.log('🔍 Starting blockchain indexer...');
    console.log(`📍 Program ID: ${this.programId.toString()}`);

    this.isRunning = true;

    // Start monitoring
    await this.monitorEvents();

    console.log('✅ Indexer started');
  }

  /**
   * Monitor on-chain events
   */
  private async monitorEvents() {
    console.log('👀 Monitoring for on-chain events...');

    // Subscribe to program logs
    this.connection.onLogs(
      this.programId,
      async (logs, ctx) => {
        try {
          await this.processLogs(logs, ctx.slot);
        } catch (error) {
          console.error('Error processing logs:', error);
        }
      },
      'confirmed'
    );

    // Also do periodic syncs (every 30 seconds)
    setInterval(async () => {
      await this.syncRecentTransactions();
    }, 30000);
  }

  /**
   * Process transaction logs
   */
  private async processLogs(logs: any, slot: number) {
    const signature = logs.signature;

    // Check if already processed
    const existing = await this.db.query(
      'SELECT id FROM events WHERE signature = $1',
      [signature]
    );

    if (existing.rows.length > 0) {
      return; // Already processed
    }

    // Parse event from logs
    const event = this.parseEvent(logs.logs);
    if (!event) {
      return; // No relevant event
    }

    // Save to database
    await this.saveEvent(event, signature, slot);

    console.log(`📝 Indexed ${event.type} event:`, signature);
  }

  /**
   * Parse event from logs
   */
  private parseEvent(logs: string[]): any | null {
    for (const log of logs) {
      // CallCreated event
      if (log.includes('CallCreated')) {
        return this.parseCallCreatedEvent(logs);
      }

      // CallChallenged event
      if (log.includes('CallChallenged')) {
        return this.parseCallChallengedEvent(logs);
      }

      // CallResolved event
      if (log.includes('CallResolved')) {
        return this.parseCallResolvedEvent(logs);
      }

      // CallAutoRefunded event
      if (log.includes('CallAutoRefunded')) {
        return this.parseCallAutoRefundedEvent(logs);
      }
    }

    return null;
  }

  /**
   * Parse CallCreated event
   */
  private parseCallCreatedEvent(logs: string[]): any {
    // TODO: Parse actual event data from logs
    // For now, return mock structure
    return {
      type: 'CallCreated',
      data: {},
    };
  }

  /**
   * Parse CallChallenged event
   */
  private parseCallChallengedEvent(logs: string[]): any {
    return {
      type: 'CallChallenged',
      data: {},
    };
  }

  /**
   * Parse CallResolved event
   */
  private parseCallResolvedEvent(logs: string[]): any {
    return {
      type: 'CallResolved',
      data: {},
    };
  }

  /**
   * Parse CallAutoRefunded event
   */
  private parseCallAutoRefundedEvent(logs: string[]): any {
    return {
      type: 'CallAutoRefunded',
      data: {},
    };
  }

  /**
   * Save event to database
   */
  private async saveEvent(event: any, signature: string, slot: number) {
    const timestamp = Math.floor(Date.now() / 1000);

    await this.db.query(
      `INSERT INTO events (id, event_type, user_address, data, signature, slot, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `evt_${signature}`,
        event.type,
        event.data.user || 'unknown',
        JSON.stringify(event.data),
        signature,
        slot,
        timestamp,
      ]
    );
  }

  /**
   * Sync recent transactions (backfill)
   */
  private async syncRecentTransactions() {
    try {
      // Get recent signatures for program
      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit: 10 }
      );

      for (const sigInfo of signatures) {
        await this.processTransaction(sigInfo.signature);
      }
    } catch (error) {
      console.error('Error syncing transactions:', error);
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(signature: string) {
    // Check if already processed
    const existing = await this.db.query(
      'SELECT id FROM events WHERE signature = $1',
      [signature]
    );

    if (existing.rows.length > 0) {
      return;
    }

    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (tx && tx.meta) {
        await this.processLogs(
          { signature, logs: tx.meta.logMessages || [] },
          tx.slot
        );
      }
    } catch (error) {
      console.error(`Error processing transaction ${signature}:`, error);
    }
  }

  /**
   * Stop indexing
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 Indexer stopped');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new Indexer();
  indexer.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', () => {
    indexer.stop();
    process.exit(0);
  });
}

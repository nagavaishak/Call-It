import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  Ed25519Program,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { CallData, OracleSignature } from '../types/index.js';
import axios from 'axios';

/**
 * Blockchain Resolver Service
 * Submits resolution transactions to Solana
 */
export class BlockchainResolver {
  private connection: Connection;
  private wallet: Wallet;
  private programId: PublicKey;

  constructor(connection: Connection, keypair: Keypair, programId: string) {
    this.connection = connection;
    this.wallet = new Wallet(keypair);
    this.programId = new PublicKey(programId);
  }

  /**
   * Submit resolution transaction to blockchain
   */
  async submitResolution(
    call: CallData,
    oracleSignatures: OracleSignature[]
  ): Promise<string | null> {
    try {
      console.log(`📤 Submitting resolution for call ${call.id}...`);

      // Load all challenge PDAs
      const challengePDAs = await this.loadChallengePDAs(call.onchainId);

      // Build remaining_accounts: [challenges, wallets, caller]
      const challengeAccounts = challengePDAs.map(c => ({
        pubkey: c.pda,
        isSigner: false,
        isWritable: false,
      }));

      const challengerWallets = challengePDAs.map(c => ({
        pubkey: c.walletPubkey,
        isSigner: false,
        isWritable: true,
      }));

      const callerWallet = {
        pubkey: new PublicKey(call.callerAddress),
        isSigner: false,
        isWritable: true,
      };

      const remainingAccounts = [
        ...challengeAccounts,
        ...challengerWallets,
        callerWallet,
      ];

      // Create Ed25519 SigVerify instructions
      const ed25519Instructions: TransactionInstruction[] = [];

      for (const sig of oracleSignatures) {
        const message = this.createResolutionMessage(
          call.onchainId,
          sig.outcome,
          sig.timestamp
        );

        const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
          publicKey: sig.signer.toBytes(),
          message: Buffer.from(message),
          signature: sig.signature,
        });

        ed25519Instructions.push(ed25519Ix);
      }

      // Compute budget for large transactions
      const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({
        units: 800_000,
      });

      // Note: For actual deployment, we'd build the resolve_call instruction using Anchor
      // For now, this is a placeholder showing the structure

      console.log(`✅ Resolution transaction prepared`);
      console.log(`   - Challenges: ${challengePDAs.length}`);
      console.log(`   - Oracle signatures: ${oracleSignatures.length}`);

      // In production, send the actual transaction here
      // const txSig = await this.connection.sendTransaction(tx, [this.wallet.payer]);
      // await this.connection.confirmTransaction(txSig);

      return 'mock-tx-signature'; // Placeholder
    } catch (error: any) {
      if (error.message?.includes('AlreadyResolved')) {
        console.log(`ℹ️  Call already resolved`);
        return null;
      }

      console.error('Failed to submit resolution:', error);
      throw error;
    }
  }

  /**
   * Create resolution message for Ed25519 signing
   */
  private createResolutionMessage(
    callId: string,
    outcome: string,
    timestamp: number
  ): Uint8Array {
    const callPubkey = new PublicKey(callId);
    const message = Buffer.concat([
      callPubkey.toBuffer(),
      Buffer.from([outcome === 'CallerWins' ? 1 : 0]),
      Buffer.from(new BigInt64Array([BigInt(timestamp)]).buffer),
    ]);
    return new Uint8Array(message);
  }

  /**
   * Load all challenge PDAs for a call
   */
  private async loadChallengePDAs(callId: string): Promise<any[]> {
    // Query backend API for challenges
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    try {
      const response = await axios.get(`${backendUrl}/api/calls/${callId}/challenges`);
      return response.data.challenges.map((c: any) => ({
        pda: new PublicKey(c.onchainId),
        walletPubkey: new PublicKey(c.challengerAddress),
        stake: BigInt(c.stake),
      }));
    } catch (error) {
      console.error('Failed to load challenges:', error);
      return [];
    }
  }
}

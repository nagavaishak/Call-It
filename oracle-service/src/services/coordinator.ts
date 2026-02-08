import { Keypair, PublicKey } from '@solana/web3.js';
import * as ed25519 from '@noble/ed25519';
import axios from 'axios';
import { CallData, OracleSignature, ValidationResult } from '../types/index.js';
import { PriceOracle } from './priceOracle.js';
import { RugDetector } from './rugDetector.js';

/**
 * Oracle Coordinator Service
 * Coordinates with peer oracles for 2-of-3 consensus
 */
export class OracleCoordinator {
  constructor(
    private keypair: Keypair,
    private nodeId: number,
    private peerUrls: string[],
    private priceOracle: PriceOracle,
    private rugDetector: RugDetector
  ) {}

  /**
   * Coordinate resolution with peer oracles
   * Returns signatures from all oracles that agree
   */
  async coordinateResolution(call: CallData): Promise<OracleSignature[] | null> {
    console.log(`🤝 Node ${this.nodeId} coordinating resolution for call ${call.id}`);

    // Step 1: Validate the call independently
    const myValidation = await this.validateCall(call);

    console.log(`📊 Node ${this.nodeId} validation:`, {
      outcome: myValidation.outcome,
      confidence: myValidation.confidence,
      reason: myValidation.reason,
    });

    // Step 2: Request validations from peer oracles
    const peerValidations = await this.requestPeerValidations(call);

    console.log(`📡 Received ${peerValidations.length} peer validations`);

    // Step 3: Check for consensus (2 of 3 must agree)
    const allValidations = [myValidation, ...peerValidations];
    const consensus = this.checkConsensus(allValidations);

    if (!consensus) {
      console.log(`❌ No consensus reached (need 2 of 3)`);
      return null;
    }

    console.log(`✅ Consensus reached: ${consensus.outcome}`);

    // Step 4: Generate Ed25519 signatures from all agreeing oracles
    const timestamp = Math.floor(Date.now() / 1000);
    const signatures: OracleSignature[] = [];

    // My signature
    const mySignature = await this.generateSignature(
      call.onchainId,
      consensus.outcome,
      timestamp
    );
    signatures.push(mySignature);

    // Request signatures from peers that agreed
    const peerSignatures = await this.requestPeerSignatures(
      call,
      consensus.outcome,
      timestamp
    );

    signatures.push(...peerSignatures);

    console.log(`🔐 Collected ${signatures.length} signatures`);

    return signatures.length >= 2 ? signatures : null;
  }

  /**
   * Validate a call independently (this oracle's opinion)
   */
  private async validateCall(call: CallData): Promise<ValidationResult> {
    try {
      if (call.category === 'TokenPrice' && call.tokenAddress) {
        return await this.validatePriceCall(call);
      } else if (call.category === 'RugPrediction' && call.tokenAddress) {
        return await this.validateRugCall(call);
      }

      return {
        outcome: 'CallerLoses',
        confidence: 0,
        reason: 'Invalid call category or missing data',
      };
    } catch (error: any) {
      console.error('Validation error:', error);
      return {
        outcome: 'CallerLoses',
        confidence: 0,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validate price prediction call
   */
  private async validatePriceCall(call: CallData): Promise<ValidationResult> {
    if (!call.tokenAddress || !call.targetPrice || !call.creationPrice) {
      return {
        outcome: 'CallerLoses',
        confidence: 0,
        reason: 'Missing price data',
      };
    }

    const priceData = await this.priceOracle.getPrice(call.tokenAddress);
    const validation = this.priceOracle.validatePriceTarget(
      call.creationPrice,
      call.targetPrice,
      priceData.currentPrice
    );

    return {
      outcome: validation.outcome,
      confidence: 1.0,
      reason: `Price validation: ${JSON.stringify(validation.data)}`,
      data: validation.data,
    };
  }

  /**
   * Validate rug prediction call
   */
  private async validateRugCall(call: CallData): Promise<ValidationResult> {
    if (!call.tokenAddress) {
      return {
        outcome: 'CallerLoses',
        confidence: 0,
        reason: 'Missing token address',
      };
    }

    const rugData = await this.rugDetector.detectRug(call.tokenAddress, call.createdAt);

    // If caller predicted rug and it is a rug, caller wins
    const outcome = rugData.isRug ? 'CallerWins' : 'CallerLoses';

    return {
      outcome,
      confidence: rugData.confidence,
      reason: `Rug detection: ${rugData.reasons.join(', ')}`,
      data: rugData,
    };
  }

  /**
   * Request validations from peer oracles
   */
  private async requestPeerValidations(call: CallData): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];

    for (const peerUrl of this.peerUrls) {
      try {
        const response = await axios.post(
          `${peerUrl}/api/validate`,
          { call },
          { timeout: 10000 }
        );

        if (response.data?.validation) {
          validations.push(response.data.validation);
        }
      } catch (error) {
        console.error(`Failed to get validation from ${peerUrl}:`, error);
      }
    }

    return validations;
  }

  /**
   * Check for consensus (2 of 3 must agree on outcome)
   */
  private checkConsensus(
    validations: ValidationResult[]
  ): { outcome: 'CallerWins' | 'CallerLoses' } | null {
    const callerWins = validations.filter(v => v.outcome === 'CallerWins').length;
    const callerLoses = validations.filter(v => v.outcome === 'CallerLoses').length;

    if (callerWins >= 2) {
      return { outcome: 'CallerWins' };
    } else if (callerLoses >= 2) {
      return { outcome: 'CallerLoses' };
    }

    return null; // No consensus
  }

  /**
   * Generate Ed25519 signature for resolution
   */
  private async generateSignature(
    callId: string,
    outcome: 'CallerWins' | 'CallerLoses',
    timestamp: number
  ): Promise<OracleSignature> {
    // Create message to sign
    const callPubkey = new PublicKey(callId);
    const message = Buffer.concat([
      callPubkey.toBuffer(),
      Buffer.from([outcome === 'CallerWins' ? 1 : 0]),
      Buffer.from(new BigInt64Array([BigInt(timestamp)]).buffer),
    ]);

    // Sign with Ed25519
    const signature = await ed25519.signAsync(
      message,
      this.keypair.secretKey.slice(0, 32)
    );

    return {
      signer: this.keypair.publicKey,
      signature: new Uint8Array(signature),
      outcome,
      timestamp,
    };
  }

  /**
   * Request signatures from peer oracles
   */
  private async requestPeerSignatures(
    call: CallData,
    outcome: 'CallerWins' | 'CallerLoses',
    timestamp: number
  ): Promise<OracleSignature[]> {
    const signatures: OracleSignature[] = [];

    for (const peerUrl of this.peerUrls) {
      try {
        const response = await axios.post(
          `${peerUrl}/api/sign`,
          { callId: call.onchainId, outcome, timestamp },
          { timeout: 10000 }
        );

        if (response.data?.signature) {
          const sig = response.data.signature;
          signatures.push({
            signer: new PublicKey(sig.signer),
            signature: new Uint8Array(sig.signature),
            outcome: sig.outcome,
            timestamp: sig.timestamp,
          });
        }
      } catch (error) {
        console.error(`Failed to get signature from ${peerUrl}:`, error);
      }
    }

    return signatures;
  }

  /**
   * Handle validation request from peer (API endpoint handler)
   */
  async handleValidationRequest(call: CallData): Promise<ValidationResult> {
    return await this.validateCall(call);
  }

  /**
   * Handle signature request from peer (API endpoint handler)
   */
  async handleSignatureRequest(
    callId: string,
    outcome: 'CallerWins' | 'CallerLoses',
    timestamp: number
  ): Promise<OracleSignature> {
    return await this.generateSignature(callId, outcome, timestamp);
  }
}

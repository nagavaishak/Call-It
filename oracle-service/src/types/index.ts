import { PublicKey } from '@solana/web3.js';

export interface CallData {
  id: string;
  onchainId: string;
  caller: string;
  callerAddress: string;
  claim: string;
  category: 'TokenPrice' | 'RugPrediction';
  tokenAddress?: string;
  targetPrice?: number;
  creationPrice?: number;
  stake: number;
  confidence: number;
  deadline: number;
  createdAt: number;
  status: 'Active' | 'ResolvedCallerWins' | 'ResolvedCallerLoses' | 'AutoRefunded';
  challengersCount: number;
}

export interface ChallengeData {
  id: string;
  onchainId: string;
  callId: string;
  challenger: string;
  challengerAddress: string;
  stake: number;
  confidence: number;
  createdAt: number;
}

export interface OracleSignature {
  signer: PublicKey;
  signature: Uint8Array;
  outcome: 'CallerWins' | 'CallerLoses';
  timestamp: number;
}

export interface ValidationResult {
  outcome: 'CallerWins' | 'CallerLoses';
  confidence: number;
  reason: string;
  data?: any;
}

export interface PriceData {
  token: string;
  currentPrice: number;
  targetPrice: number;
  creationPrice: number;
  priceChange: number;
  sources: string[];
  timestamp: number;
}

export interface RugDetectionData {
  token: string;
  isRug: boolean;
  confidence: number;
  reasons: string[];
  priceCollapse: boolean;
  liquidityRemoved: boolean;
  topHoldersSold: boolean;
  timestamp: number;
}

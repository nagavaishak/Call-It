import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { RugDetectionData } from '../types/index.js';

/**
 * Rug Detection Service
 * Detects rug pulls using 2-of-3 conditions
 */
export class RugDetector {
  constructor(private connection: Connection) {}

  /**
   * Detect if a token is a rug pull
   * Requires 2 of 3 conditions:
   * 1. Price collapse sustained 12+ hours (not flash crash)
   * 2. Top 10 holders sold >60% combined
   * 3. Liquidity removed permanently
   */
  async detectRug(tokenAddress: string, createdAt: number): Promise<RugDetectionData> {
    const [priceCollapse, topHoldersSold, liquidityRemoved] = await Promise.allSettled([
      this.checkPriceCollapse(tokenAddress, createdAt),
      this.checkTopHoldersSold(tokenAddress),
      this.checkLiquidityRemoved(tokenAddress),
    ]);

    const conditions = {
      priceCollapse: priceCollapse.status === 'fulfilled' && priceCollapse.value,
      topHoldersSold: topHoldersSold.status === 'fulfilled' && topHoldersSold.value,
      liquidityRemoved: liquidityRemoved.status === 'fulfilled' && liquidityRemoved.value,
    };

    const passedConditions = Object.values(conditions).filter(Boolean).length;
    const isRug = passedConditions >= 2; // Require 2 of 3

    const reasons: string[] = [];
    if (conditions.priceCollapse) reasons.push('Price collapsed >80% sustained 12+ hours');
    if (conditions.topHoldersSold) reasons.push('Top 10 holders sold >60% combined');
    if (conditions.liquidityRemoved) reasons.push('Liquidity permanently removed');

    return {
      token: tokenAddress,
      isRug,
      confidence: passedConditions / 3, // 0.33, 0.66, or 1.0
      reasons,
      priceCollapse: conditions.priceCollapse,
      liquidityRemoved: conditions.liquidityRemoved,
      topHoldersSold: conditions.topHoldersSold,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Check if price collapsed >80% and sustained for 12+ hours
   */
  private async checkPriceCollapse(tokenAddress: string, createdAt: number): Promise<boolean> {
    try {
      // Fetch historical price data from DexScreener
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        return false;
      }

      const pair = response.data.pairs[0];
      const currentPrice = parseFloat(pair.priceUsd);

      // Get price 12 hours ago from price change data
      const priceChange12h = pair.priceChange?.h12;

      if (!priceChange12h) {
        return false;
      }

      // Check if price dropped >80% and it's been 12+ hours since call creation
      const timeSinceCreation = Date.now() / 1000 - createdAt;
      const priceDropped = priceChange12h < -80;
      const timeElapsed = timeSinceCreation >= 43200; // 12 hours

      return priceDropped && timeElapsed;
    } catch (error) {
      console.error('Error checking price collapse:', error);
      return false;
    }
  }

  /**
   * Check if top 10 holders sold >60% combined
   */
  private async checkTopHoldersSold(tokenAddress: string): Promise<boolean> {
    try {
      // This would require blockchain analysis
      // For MVP, we'll use a simplified check via Helius/RPC

      // Get token accounts for the mint
      const mintPubkey = new PublicKey(tokenAddress);
      const tokenAccounts = await this.connection.getProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        {
          filters: [
            { dataSize: 165 },
            {
              memcmp: {
                offset: 0,
                bytes: mintPubkey.toBase58(),
              },
            },
          ],
        }
      );

      // For MVP, return false (would need more complex analysis)
      // In production, track holder changes over time
      return false;
    } catch (error) {
      console.error('Error checking top holders:', error);
      return false;
    }
  }

  /**
   * Check if liquidity was permanently removed
   */
  private async checkLiquidityRemoved(tokenAddress: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        // No pairs found = liquidity likely removed
        return true;
      }

      const pair = response.data.pairs[0];
      const liquidityUsd = pair.liquidity?.usd || 0;

      // If liquidity dropped below $1000, consider it removed
      return liquidityUsd < 1000;
    } catch (error) {
      console.error('Error checking liquidity:', error);
      return false;
    }
  }
}

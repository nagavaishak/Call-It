import axios from 'axios';
import { PriceData } from '../types/index.js';

/**
 * Price Oracle Service
 * Fetches prices from multiple sources and provides consensus price
 */
export class PriceOracle {
  private readonly DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
  private readonly JUPITER_API = 'https://price.jup.ag/v4';

  /**
   * Get current price for a token from multiple sources
   */
  async getPrice(tokenAddress: string): Promise<PriceData> {
    const [dexScreenerPrice, jupiterPrice] = await Promise.allSettled([
      this.getDexScreenerPrice(tokenAddress),
      this.getJupiterPrice(tokenAddress),
    ]);

    const prices: number[] = [];
    const sources: string[] = [];

    if (dexScreenerPrice.status === 'fulfilled' && dexScreenerPrice.value) {
      prices.push(dexScreenerPrice.value);
      sources.push('DexScreener');
    }

    if (jupiterPrice.status === 'fulfilled' && jupiterPrice.value) {
      prices.push(jupiterPrice.value);
      sources.push('Jupiter');
    }

    if (prices.length === 0) {
      throw new Error(`Unable to fetch price for token ${tokenAddress}`);
    }

    // Calculate median price for consensus
    const medianPrice = this.calculateMedian(prices);

    return {
      token: tokenAddress,
      currentPrice: medianPrice,
      targetPrice: 0, // Will be set from call data
      creationPrice: 0, // Will be set from call data
      priceChange: 0, // Will be calculated
      sources,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Validate if target price was reached
   */
  validatePriceTarget(
    creationPrice: number,
    targetPrice: number,
    currentPrice: number
  ): {outcome: 'CallerWins' | 'CallerLoses', data: any} {
    // Calculate required gain percentage
    const targetGain = ((targetPrice - creationPrice) / creationPrice) * 100;
    const actualGain = ((currentPrice - creationPrice) / creationPrice) * 100;

    const outcome = actualGain >= targetGain ? 'CallerWins' : 'CallerLoses';

    return {
      outcome,
      data: {
        creationPrice,
        targetPrice,
        currentPrice,
        targetGain: targetGain.toFixed(2) + '%',
        actualGain: actualGain.toFixed(2) + '%',
        difference: (actualGain - targetGain).toFixed(2) + '%',
      },
    };
  }

  /**
   * Fetch price from DexScreener
   */
  private async getDexScreenerPrice(tokenAddress: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.DEXSCREENER_API}/tokens/${tokenAddress}`, {
        timeout: 5000,
      });

      if (response.data?.pairs && response.data.pairs.length > 0) {
        // Get the pair with highest liquidity
        const sortedPairs = response.data.pairs.sort(
          (a: any, b: any) => b.liquidity.usd - a.liquidity.usd
        );
        return parseFloat(sortedPairs[0].priceUsd);
      }

      return null;
    } catch (error) {
      console.error('DexScreener API error:', error);
      return null;
    }
  }

  /**
   * Fetch price from Jupiter
   */
  private async getJupiterPrice(tokenAddress: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.JUPITER_API}/price`, {
        params: { ids: tokenAddress },
        timeout: 5000,
      });

      if (response.data?.data && response.data.data[tokenAddress]) {
        return response.data.data[tokenAddress].price;
      }

      return null;
    } catch (error) {
      console.error('Jupiter API error:', error);
      return null;
    }
  }

  /**
   * Calculate median of an array of numbers
   */
  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }
}

// server/services/dexscreener.js
import axios from 'axios';
import { withRetry, delay } from './tokenHolders.js';

/**
 * Fetch token pair data from DexScreener API
 * @param {string} tokenAddress - Token address
 * @returns {Object} Processed token market data
 */
async function fetchDexScreenerData(tokenAddress) {
  console.log(`LOG: fetchDexScreenerData - Starting for: ${tokenAddress}`);
  
  try {
    // Fetch data from DexScreener API with retry
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    console.log(`LOG: fetchDexScreenerData - Requesting data from: ${url}`);
    
    const response = await withRetry(async () => {
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaTokenAnalyzer/1.0'
        },
        timeout: 15000
      });
      
      if (!res.data || !res.data.pairs) {
        throw new Error('Invalid response format from DexScreener API');
      }
      
      return res;
    }, {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 15000,
      backoffFactor: 2
    });
    
    const pairs = response.data.pairs || [];
    
    if (pairs.length === 0) {
      console.log(`LOG: fetchDexScreenerData - No pairs found for token: ${tokenAddress}`);
      return {
        success: false,
        error: 'No trading pairs found for this token'
      };
    }
    
    console.log(`LOG: fetchDexScreenerData - Found ${pairs.length} trading pairs`);
    
    // Find the pair with the highest liquidity (usually the main pair)
    pairs.sort((a, b) => {
      const liquidityA = parseFloat(a.liquidity?.usd || 0);
      const liquidityB = parseFloat(b.liquidity?.usd || 0);
      return liquidityB - liquidityA;
    });
    
    const mainPair = pairs[0];
    console.log(`LOG: fetchDexScreenerData - Main pair: ${mainPair.baseToken.symbol}/${mainPair.quoteToken.symbol} on ${mainPair.dexId}`);
    
    // Extract market data
    const marketData = {
      success: true,
      source: 'dexscreener',
      token_name: mainPair.baseToken.name,
      token_symbol: mainPair.baseToken.symbol,
      token_address: mainPair.baseToken.address,
      price_usd: parseFloat(mainPair.priceUsd || 0),
      price_native: parseFloat(mainPair.priceNative || 0),
      quote_token: mainPair.quoteToken.symbol,
      market_cap: parseFloat(mainPair.marketCap || 0),
      fdv: parseFloat(mainPair.fdv || 0),
      liquidity_usd: parseFloat(mainPair.liquidity?.usd || 0),
      volume_24h: parseFloat(mainPair.volume?.h24 || 0),
      price_change: {
        h1: parseFloat(mainPair.priceChange?.h1 || 0),
        h24: parseFloat(mainPair.priceChange?.h24 || 0)
      },
      transactions: {
        h24: {
          buys: parseInt(mainPair.txns?.h24?.buys || 0),
          sells: parseInt(mainPair.txns?.h24?.sells || 0)
        }
      },
      pair_address: mainPair.pairAddress,
      dex: mainPair.dexId,
      links: {
        dexscreener: mainPair.url,
        website: mainPair.info?.websites?.[0]?.url || null,
        socials: mainPair.info?.socials || []
      },
      all_pairs: pairs.map(pair => ({
        dex: pair.dexId,
        pair_address: pair.pairAddress,
        quote_token: pair.quoteToken.symbol,
        price_usd: parseFloat(pair.priceUsd || 0),
        liquidity_usd: parseFloat(pair.liquidity?.usd || 0),
        volume_24h: parseFloat(pair.volume?.h24 || 0)
      })),
      timestamp: new Date().toISOString()
    };
    
    // Calculate buy/sell ratio
    const buys = marketData.transactions.h24.buys;
    const sells = marketData.transactions.h24.sells;
    if (sells > 0) {
      marketData.buy_sell_ratio = parseFloat((buys / sells).toFixed(2));
    }
    
    console.log(`LOG: fetchDexScreenerData - Processing complete for: ${tokenAddress}`);
    return marketData;
  } catch (error) {
    console.error('ERROR in fetchDexScreenerData:', error);
    return {
      success: false,
      error: `Failed to fetch DexScreener data: ${error.message}`
    };
  }
}

export {
  fetchDexScreenerData
};
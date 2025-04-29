// server/services/dexscreener.js - SIMPLIFIED FIX
import axios from 'axios';
import { withRetry, delay } from './tokenHolders.js';

/**
 * Fetch token pair data from DexScreener API with enhanced information
 * @param {string} tokenAddress - Token address
 * @returns {Object} Processed token market data with all available information
 */
async function fetchDexScreenerData(tokenAddress) {
  console.log(`LOG: fetchDexScreenerData - Starting for token address: ${tokenAddress}`);
  
  try {
    // Normalize token address for comparisons
    const normalizedRequestedAddress = tokenAddress.toLowerCase();
    
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
    
    // SIMPLE FIX: Filter to find pairs where our token is exactly the requested token
    // and just take the first match (which is usually the most established pair)
    let relevantPairs = pairs.filter(pair => {
      return (pair.baseToken.address.toLowerCase() === normalizedRequestedAddress) || 
             (pair.quoteToken.address.toLowerCase() === normalizedRequestedAddress);
    });
    
    // Find the first pair where our token is the BASE token (preferred)
    const baseTokenPair = relevantPairs.find(pair => 
      pair.baseToken.address.toLowerCase() === normalizedRequestedAddress
    );
    
    // If we found a pair where our token is the base, use that
    // Otherwise use the first pair in the filtered list
    const mainPair = baseTokenPair || relevantPairs[0];
    console.log(mainPair.txns, 'fuckupododo')
    
    if (!mainPair) {
      console.log(`LOG: fetchDexScreenerData - No relevant pairs found where ${tokenAddress} is base or quote token`);
      return {
        success: false,
        error: 'No relevant trading pairs found for this token'
      };
    }
    
    // Determine if the requested token is the base or quote in this pair
    const isBase = mainPair.baseToken.address.toLowerCase() === normalizedRequestedAddress;
    
    // Get token info from the correct token object
    const tokenInfo = isBase ? mainPair.baseToken : mainPair.quoteToken;
    const pairToken = isBase ? mainPair.quoteToken : mainPair.baseToken;
    
    console.log(`LOG: fetchDexScreenerData - Selected pair: ${tokenInfo.symbol}/${pairToken.symbol} on ${mainPair.dexId}`);
    console.log(`LOG: fetchDexScreenerData - Token ${tokenAddress} is the ${isBase ? 'base' : 'quote'} token in this pair`);
    
    // Log the addresses for verification
    console.log(`LOG: Token Address Check - Requested: ${normalizedRequestedAddress}, Using: ${tokenInfo.address.toLowerCase()}`);
    
    // If our token is the quote token, we need to invert some of the metrics
    const price = isBase ? 
      parseFloat(mainPair.priceUsd || 0) : 
      (1 / parseFloat(mainPair.priceUsd || 1));
    
    const priceNative = isBase ? 
      parseFloat(mainPair.priceNative || 0) : 
      (1 / parseFloat(mainPair.priceNative || 1));
    
    // Extract ALL market data from main pair
    const marketData = {
      success: true,
      source: 'dexscreener',
      
      // Token info
      token_name: tokenInfo.name,
      token_symbol: tokenInfo.symbol,
      token_address: tokenInfo.address,
      
      // Quote token info (pair token)
      pair_token: {
        name: pairToken.name,
        symbol: pairToken.symbol,
        address: pairToken.address
      },
      
      // Token role in the pair
      is_base_token: isBase,
      
      // Price data (adjusted for base/quote position)
      price_usd: price,
      price_native: priceNative,
      
      // Market metrics
      market_cap: parseFloat(mainPair.marketCap || 0),
      fdv: parseFloat(mainPair.fdv || 0),
      liquidity_usd: parseFloat(mainPair.liquidity?.usd || 0),
      liquidity_base: parseFloat(mainPair.liquidity?.base || 0),
      liquidity_quote: parseFloat(mainPair.liquidity?.quote || 0),
      
      // Volume data for all timeframes
      volume: {
        h24: parseFloat(mainPair.volume?.h24 || 0),
        h6: parseFloat(mainPair.volume?.h6 || 0),
        h1: parseFloat(mainPair.volume?.h1 || 0),
        m5: parseFloat(mainPair.volume?.m5 || 0)
      },
      
      // Price change for all timeframes
      price_change: {
        h24: parseFloat(mainPair.priceChange?.h24 || 0) * (isBase ? 1 : -1),
        h6: parseFloat(mainPair.priceChange?.h6 || 0) * (isBase ? 1 : -1),
        h1: parseFloat(mainPair.priceChange?.h1 || 0) * (isBase ? 1 : -1),
        m5: parseFloat(mainPair.priceChange?.m5 || 0) * (isBase ? 1 : -1)
      },

      // Transactions for all timeframes
      transactions: {
        h24: {
          buys: parseInt(mainPair.txns?.h24?.buys || 0),
          sells: parseInt(mainPair.txns?.h24?.sells || 0),
          total: parseInt((mainPair.txns?.h24?.buys || 0) + (mainPair.txns?.h24?.sells || 0))
        },
        h6: {
          buys: parseInt(mainPair.txns?.h6?.buys || 0),
          sells: parseInt(mainPair.txns?.h6?.sells || 0),
          total: parseInt((mainPair.txns?.h6?.buys || 0) + (mainPair.txns?.h6?.sells || 0))
        },
        h1: {
          buys: parseInt(mainPair.txns?.h1?.buys || 0),
          sells: parseInt(mainPair.txns?.h1?.sells || 0),
          total: parseInt((mainPair.txns?.h1?.buys || 0) + (mainPair.txns?.h1?.sells || 0))
        },
        m5: {
          buys: parseInt(mainPair.txns?.m5?.buys || 0),
          sells: parseInt(mainPair.txns?.m5?.sells || 0),
          total: parseInt((mainPair.txns?.m5?.buys || 0) + (mainPair.txns?.m5?.sells || 0))
        }
      },
      
      // Pair info
      pair_address: mainPair.pairAddress,
      dex: mainPair.dexId,
      chain_id: mainPair.chainId,
      pair_created_at: mainPair.pairCreatedAt,
      
      // Labels (CLMM, etc.)
      labels: mainPair.labels || [],
      
      // Links and social info
      links: {
        dexscreener: mainPair.url,
        website: mainPair.info?.websites?.[0]?.url || null,
        docs: mainPair.info?.websites?.find(w => w.label === 'Docs')?.url || null,
        socials: mainPair.info?.socials || []
      },
      
      // Token images
      images: {
        token: mainPair.info?.imageUrl || null,
        header: mainPair.info?.header || null,
        open_graph: mainPair.info?.openGraph || null
      },
      
      // All pairs data - only include pairs containing our token
      all_pairs: relevantPairs
        .filter(pair => {
          const pairBaseMatches = pair.baseToken.address.toLowerCase() === normalizedRequestedAddress;
          const pairQuoteMatches = pair.quoteToken.address.toLowerCase() === normalizedRequestedAddress;
          return pairBaseMatches || pairQuoteMatches;
        })
        .map(pair => {
          const isPairBase = pair.baseToken.address.toLowerCase() === normalizedRequestedAddress;
          return {
            dex: pair.dexId,
            chain_id: pair.chainId,
            pair_address: pair.pairAddress,
            is_base: isPairBase,
            pair_token: isPairBase ? pair.quoteToken.symbol : pair.baseToken.symbol,
            price_usd: isPairBase ? 
              parseFloat(pair.priceUsd || 0) : 
              (1 / parseFloat(pair.priceUsd || 1)),
            price_native: isPairBase ? 
              parseFloat(pair.priceNative || 0) : 
              (1 / parseFloat(pair.priceNative || 1)),
            liquidity_usd: parseFloat(pair.liquidity?.usd || 0),
            volume_24h: parseFloat(pair.volume?.h24 || 0),
            price_change_24h: parseFloat(pair.priceChange?.h24 || 0) * (isPairBase ? 1 : -1),
            txCount24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
            labels: pair.labels || []
          }
        }),
      
      // Derived metrics
      buy_sell_ratio_24h: (mainPair.txns?.h24?.sells > 0) ? 
        parseFloat((mainPair.txns?.h24?.buys / mainPair.txns?.h24?.sells).toFixed(2)) : 0,
      
      // Include creation timestamp
      timestamp: new Date().toISOString(),
      
      // Include full raw data for reference
      raw_main_pair: mainPair
    };
    
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
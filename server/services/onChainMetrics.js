import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { fetchAllTokenHolders } from './tokenHolders.js';
// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

/**
 * Analyzes transaction patterns for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Transaction pattern analysis
 */
// Update analyzeTransactionPatterns
// Update analyzeTransactionPatterns
async function analyzeTransactionPatterns(tokenAddress) {
  try {
    // Get recent signatures only first
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(tokenAddress),
      { limit: 100 }
    );

    // Analyze transaction patterns
    const patterns = {
      total_transactions: signatures.length,
      recent_signatures: signatures.slice(0, 10).map(sig => sig.signature),
      transaction_frequency: 0,
      large_transactions: 0
    };

    // Calculate timeframe for frequency
    if (signatures.length > 1) {
      const oldestTimestamp = signatures[signatures.length - 1].blockTime || 0;
      const newestTimestamp = signatures[0].blockTime || 0;
      const timeSpan = newestTimestamp - oldestTimestamp;
      
      // Calculate transactions per hour if we have valid timestamps
      if (timeSpan > 0) {
        patterns.transaction_frequency = (signatures.length / (timeSpan / 3600)).toFixed(2);
      }
    }

    return patterns;
  } catch (error) {
    console.error('Error analyzing transaction patterns:', error);
    return { 
      success: false,
      error: `Failed to analyze transaction patterns: ${error.message}` 
    };
  }
}


/**
 * Analyzes whale activity for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Whale activity analysis
 */
async function analyzeWhaleActivity(tokenAddress) {
  try {
  
    const holderData = await fetchAllTokenHolders(tokenAddress, {
      maxPages: 3,
      pageSize: 20,
      showZeroBalance: false
    });
    
    if (!holderData.success) {
      throw new Error(holderData.error || 'Failed to fetch token holders');
    }
    
    // Format the data for whale analysis
    const whaleAnalysis = {
      success: true,
      total_holders: holderData.unique_holder_count,
      top_holders: holderData.top_holders || [],
      concentration_percentage: holderData.top10_concentration_percent || 0,
      data_source: holderData.data_source
    };
    
    // Add distribution data if available
    if (holderData.holders_by_balance_range) {
      whaleAnalysis.distribution = holderData.holders_by_balance_range;
    }
    
    return whaleAnalysis;
  } catch (error) {
    console.error('Error analyzing whale activity:', error);
    return { 
      success: false, 
      error: `Failed to analyze whale activity: ${error.message}`
    };
  }
}

/**
 * Analyzes liquidity metrics for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Liquidity analysis
 */
async function analyzeLiquidityMetrics(tokenAddress) {
  try {
    // Try multiple sources with fallback
    const sources = [
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      `https://api.solanafm.com/v0/tokens/${tokenAddress}/market-info`
    ];
    
    let data = null;
    let source = '';
    
    // Try each source until one works
    for (const url of sources) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data) {
          data = response.data;
          source = url;
          break;
        }
      } catch (sourceError) {
        console.log(`Source ${url} failed, trying next...`);
      }
    }
    
    if (!data) {
      throw new Error('All liquidity data sources failed');
    }
    
    // Enhanced liquidity data with more market information
    const liquidityData = {
      success: true,
      source: source,
      price_usd: 0,
      liquidity_usd: 0,
      volume_24h: 0,
      // New fields
      token_name: null,
      token_symbol: null,
      market_cap: null,
      fdv: null, // Fully Diluted Valuation
      price_change_24h: null,
      pair_address: null,
      social_links: [],
      websites: [],
      data_timestamp: new Date().toISOString()
    };
    
    // Extract relevant fields (structure depends on which API worked)
    if (source.includes('dexscreener')) {
      const pairs = data.pairs || [];
      if (pairs.length > 0) {
        // Get the first pair for basic info
        const mainPair = pairs[0];
        
        liquidityData.price_usd = parseFloat(mainPair.priceUsd || 0);
        liquidityData.liquidity_usd = parseFloat(mainPair.liquidity?.usd || 0);
        liquidityData.volume_24h = parseFloat(mainPair.volume?.h24 || 0);
        
        // Extract new market data
        liquidityData.token_name = mainPair.baseToken?.name || null;
        liquidityData.token_symbol = mainPair.baseToken?.symbol || null;
        liquidityData.market_cap = parseFloat(mainPair.marketCap || 0);
        liquidityData.fdv = parseFloat(mainPair.fdv || 0);
        liquidityData.price_change_24h = parseFloat(mainPair.priceChange?.h24 || 0);
        liquidityData.pair_address = mainPair.pairAddress || null;
        
        // Extract social links and websites
        if (mainPair.info) {
          liquidityData.social_links = mainPair.info.socials || [];
          liquidityData.websites = mainPair.info.websites || [];
        }
        
        // Calculate extra metrics like buy/sell ratio if available
        if (mainPair.txns && mainPair.txns.h24) {
          const buys = mainPair.txns.h24.buys || 0;
          const sells = mainPair.txns.h24.sells || 0;
          if (sells > 0) {
            liquidityData.buy_sell_ratio = parseFloat((buys / sells).toFixed(2));
          }
        }
      }
    } else if (source.includes('solanafm')) {
      // Extract from SolanaFM data structure
      // Structure would depend on their API response
    }
    
    return liquidityData;
  } catch (error) {
    console.error('Error analyzing liquidity metrics:', error);
    return { 
      success: false, 
      error: `Failed to analyze liquidity metrics: ${error.message}`
    };
  }
}

/**
 * Comprehensive on-chain metrics analysis
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Complete on-chain analysis
 */
async function analyzeOnChainMetrics(tokenAddress) {
  try {
    // Run all analyses in parallel but catch errors for each
    const [transactionResults, whaleResults, liquidityResults] = await Promise.allSettled([
      analyzeTransactionPatterns(tokenAddress),
      analyzeWhaleActivity(tokenAddress),
      analyzeLiquidityMetrics(tokenAddress)
    ]);
    
    // Prepare results, including any that failed
    const result = {
      success: true,
      transaction_patterns: transactionResults.status === 'fulfilled' ? transactionResults.value : { 
        success: false, error: "Analysis failed" 
      },
      whale_activity: whaleResults.status === 'fulfilled' ? whaleResults.value : { 
        success: false, error: "Analysis failed" 
      },
      liquidity_metrics: liquidityResults.status === 'fulfilled' ? liquidityResults.value : { 
        success: false, error: "Analysis failed" 
      },
      timestamp: new Date().toISOString()
    };
    
    // Extract key market information for top level access
    if (liquidityResults.status === 'fulfilled' && liquidityResults.value.success) {
      const metrics = liquidityResults.value;
      
      // Move important market metrics to the top level for easier access
      result.market_data = {
        token_name: metrics.token_name,
        token_symbol: metrics.token_symbol,
        price_usd: metrics.price_usd,
        market_cap: metrics.market_cap,
        fdv: metrics.fdv,
        price_change_24h: metrics.price_change_24h,
        volume_24h: metrics.volume_24h,
        liquidity_usd: metrics.liquidity_usd,
        buy_sell_ratio: metrics.buy_sell_ratio
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in on-chain metrics analysis:', error);
    return { 
      success: false, 
      error: `Failed to analyze on-chain metrics: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

export {
  analyzeTransactionPatterns,
  analyzeWhaleActivity,
  analyzeLiquidityMetrics,
  analyzeOnChainMetrics
}; 
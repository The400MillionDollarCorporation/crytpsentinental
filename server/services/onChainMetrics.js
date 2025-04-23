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
    
    // Extract liquidity data based on which source worked
    const liquidityData = {
      success: true,
      source: source,
      price_usd: 0,
      liquidity_usd: 0,
      volume_24h: 0,
      data_timestamp: new Date().toISOString()
    };
    
    // Extract relevant fields (structure depends on which API worked)
    if (source.includes('dexscreener')) {
      const pairs = data.pairs || [];
      if (pairs.length > 0) {
        liquidityData.price_usd = parseFloat(pairs[0].priceUsd || 0);
        liquidityData.liquidity_usd = parseFloat(pairs[0].liquidity?.usd || 0);
        liquidityData.volume_24h = parseFloat(pairs[0].volume?.h24 || 0);
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
    return {
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
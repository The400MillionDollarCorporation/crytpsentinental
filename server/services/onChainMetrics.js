import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

/**
 * Analyzes transaction patterns for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Transaction pattern analysis
 */
async function analyzeTransactionPatterns(tokenAddress) {
  try {
    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(tokenAddress),
      { limit: 100 }
    );

    // Analyze transaction patterns
    const patterns = {
      total_transactions: signatures.length,
      average_transaction_size: 0,
      transaction_frequency: 0,
      large_transactions: 0,
      recent_activity: []
    };

    let totalSize = 0;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Process transactions
    for (const sig of signatures) {
      const tx = await connection.getTransaction(sig.signature);
      
      if (tx) {
        // Calculate transaction size
        const size = tx.meta?.fee || 0;
        totalSize += size;

        // Check for large transactions
        if (size > 1000) { // Arbitrary threshold
          patterns.large_transactions++;
        }

        // Track recent activity
        if (sig.blockTime && sig.blockTime * 1000 > oneDayAgo) {
          patterns.recent_activity.push({
            signature: sig.signature,
            timestamp: new Date(sig.blockTime * 1000).toISOString(),
            size: size
          });
        }
      }
    }

    // Calculate averages
    if (signatures.length > 0) {
      patterns.average_transaction_size = totalSize / signatures.length;
      patterns.transaction_frequency = signatures.length / 24; // Transactions per hour
    }

    return patterns;
  } catch (error) {
    console.error('Error analyzing transaction patterns:', error);
    return { error: `Failed to analyze transaction patterns: ${error.message}` };
  }
}

/**
 * Analyzes whale activity for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Whale activity analysis
 */
async function analyzeWhaleActivity(tokenAddress) {
  try {

    const accounts = await connection.getProgramAccounts(
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Token Program
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: tokenAddress
            }
          }
        ]
      }
    );

    // Analyze whale activity
    const whaleAnalysis = {
      total_holders: accounts.length,
      top_holders: [],
      whale_threshold: 0,
      whale_count: 0
    };

    // Process accounts
    for (const account of accounts) {
      const accountInfo = await connection.getParsedAccountInfo(account.pubkey);
      
      if (accountInfo.value?.data) {
        const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
        
        // Track top holders
        whaleAnalysis.top_holders.push({
          address: account.pubkey.toString(),
          balance: balance
        });
      }
    }

    // Sort holders by balance
    whaleAnalysis.top_holders.sort((a, b) => b.balance - a.balance);

    // Calculate whale threshold (top 1%)
    const whaleThresholdIndex = Math.floor(accounts.length * 0.01);
    whaleAnalysis.whale_threshold = whaleAnalysis.top_holders[whaleThresholdIndex]?.balance || 0;

    // Count whales
    whaleAnalysis.whale_count = whaleAnalysis.top_holders.filter(
      holder => holder.balance >= whaleAnalysis.whale_threshold
    ).length;

    return whaleAnalysis;
  } catch (error) {
    console.error('Error analyzing whale activity:', error);
    return { error: `Failed to analyze whale activity: ${error.message}` };
  }
}

/**
 * Analyzes liquidity metrics for a token
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Liquidity analysis
 */
async function analyzeLiquidityMetrics(tokenAddress) {
  try {
    // Get liquidity data from Jupiter API
    const response = await axios.get(
      `https://price.jup.ag/v4/price?ids=${tokenAddress}`
    );

    const liquidityData = {
      price: response.data?.data?.[tokenAddress]?.price || 0,
      liquidity_pools: [],
      total_liquidity: 0,
      price_impact: 0
    };

    // Get liquidity pool information
    const poolsResponse = await axios.get(
      `https://price.jup.ag/v4/pools?ids=${tokenAddress}`
    );

    if (poolsResponse.data?.data) {
      liquidityData.liquidity_pools = poolsResponse.data.data.map(pool => ({
        pool_address: pool.address,
        token_a: pool.tokenA,
        token_b: pool.tokenB,
        liquidity: pool.liquidity
      }));

      // Calculate total liquidity
      liquidityData.total_liquidity = liquidityData.liquidity_pools.reduce(
        (sum, pool) => sum + pool.liquidity,
        0
      );
    }

    return liquidityData;
  } catch (error) {
    console.error('Error analyzing liquidity metrics:', error);
    return { error: `Failed to analyze liquidity metrics: ${error.message}` };
  }
}

/**
 * Comprehensive on-chain metrics analysis
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Complete on-chain analysis
 */
async function analyzeOnChainMetrics(tokenAddress) {
  try {
    const transactionPatterns = await analyzeTransactionPatterns(tokenAddress);
    const whaleActivity = await analyzeWhaleActivity(tokenAddress);
    const liquidityMetrics = await analyzeLiquidityMetrics(tokenAddress);

    return {
      transaction_patterns: transactionPatterns,
      whale_activity: whaleActivity,
      liquidity_metrics: liquidityMetrics,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in on-chain metrics analysis:', error);
    return { error: `Failed to analyze on-chain metrics: ${error.message}` };
  }
}

export {
  analyzeTransactionPatterns,
  analyzeWhaleActivity,
  analyzeLiquidityMetrics,
  analyzeOnChainMetrics
}; 
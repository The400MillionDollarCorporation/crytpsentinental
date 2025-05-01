// analyzeToken.js
import { analyzeOnChainMetrics } from './server/services/onChainMetrics.js';
import { analyzeSocialSentiment } from './server/services/socialSentiment.js';
import { getTokenDetails } from './server/services/tokenData.js';

/**
 * Analyzes a Solana token comprehensively
 * @param {string} tokenAddress - The token's mint address
 * @param {Object} socialInfo - Optional social media information
 * @returns {Object} Complete token analysis
 */
async function analyzeToken(tokenAddress, socialInfo = {}) {
  try {
    console.log(`Starting analysis for token: ${tokenAddress}`);
    
    // 1. Get basic token details
    console.log('Fetching token details...');
    const tokenDetails = await getTokenDetails(tokenAddress);
    
    // 2. Analyze on-chain metrics
    console.log('Analyzing on-chain metrics...');
    const onChainAnalysis = await analyzeOnChainMetrics(tokenAddress);
    
    // 3. Analyze social sentiment if social info is provided
    let socialAnalysis = null;
    if (socialInfo.name) {
      console.log('Analyzing social sentiment...');
      socialAnalysis = await analyzeSocialSentiment(socialInfo);
    }
    
    // Combine all analyses
    const comprehensiveAnalysis = {
      token_address: tokenAddress,
      token_details: tokenDetails,
      on_chain_metrics: onChainAnalysis,
      social_sentiment: socialAnalysis,
      timestamp: new Date().toISOString()
    };
    
    return comprehensiveAnalysis;
  } catch (error) {
    console.error('Error in token analysis:', error);
    return { 
      error: `Failed to analyze token: ${error.message}`,
      token_address: tokenAddress 
    };
  }
}

// Example usage
const tokenAddress = process.argv[2]; // Get token address from command line
const socialInfo = {
  name: process.argv[3], // Project name
  twitterHandle: process.argv[4], // Optional Twitter handle
  discordServerId: process.argv[5] // Optional Discord server ID
};

if (!tokenAddress) {
  console.log('Usage: node analyzeToken.js <token_address> [project_name] [twitter_handle] [discord_server_id]');
  process.exit(1);
}

// Run the analysis
analyzeToken(tokenAddress, socialInfo)
  .then(analysis => {
    console.log('\nToken Analysis Results:');
    console.log(JSON.stringify(analysis, null, 2));
  })
  .catch(error => {
    console.error('Analysis failed:', error);
  }); 
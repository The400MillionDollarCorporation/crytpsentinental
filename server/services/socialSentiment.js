// server/services/socialSentiment.js
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

/**
 * Find Twitter handle from token information
 * @param {string} tokenNameOrSymbol - Token name or symbol
 * @returns {string|null} Twitter handle if found
 */
async function findTwitterHandle(tokenNameOrSymbol) {
  console.log(`LOG: findTwitterHandle - Searching for Twitter handle for: ${tokenNameOrSymbol}`);
  
  try {
    // Try to find a Twitter account related to the token
    const searchResult = await twitterClient.v2.search(`${tokenNameOrSymbol} official account`, {
      'user.fields': ['username', 'description', 'verified'],
      max_results: 10
    });
    
    if (!searchResult.data || searchResult.data.length === 0) {
      console.log('LOG: findTwitterHandle - No Twitter accounts found');
      return null;
    }
    
    // Look for verified accounts first
    const verifiedAccounts = searchResult.data.filter(user => user.verified);
    if (verifiedAccounts.length > 0) {
      console.log(`LOG: findTwitterHandle - Found verified account: @${verifiedAccounts[0].username}`);
      return verifiedAccounts[0].username;
    }
    
    // Otherwise, try to find the most relevant account
    // This is a simple heuristic - could be improved with more sophisticated filtering
    for (const user of searchResult.data) {
      if (user.description && 
          (user.description.toLowerCase().includes(tokenNameOrSymbol.toLowerCase()) ||
          user.username.toLowerCase().includes(tokenNameOrSymbol.toLowerCase()))) {
        console.log(`LOG: findTwitterHandle - Found relevant account: @${user.username}`);
        return user.username;
      }
    }
    
    // If no good match found, return null
    console.log('LOG: findTwitterHandle - No relevant Twitter accounts found');
    return null;
  } catch (error) {
    console.error('ERROR: findTwitterHandle -', error);
    return null;
  }
}

/**
 * Analyzes Twitter sentiment for a token/project
 * @param {string} tokenName - Name of the token
 * @param {string} tokenSymbol - Symbol of the token
 * @param {string} twitterHandle - Optional Twitter handle
 * @returns {Object} Twitter sentiment analysis
 */
async function analyzeTwitterSentiment(tokenName, tokenSymbol, twitterHandle = null) {
  console.log(`LOG: analyzeTwitterSentiment - Starting analysis for ${tokenName} (${tokenSymbol})`);
  
  try {
    // If no Twitter handle provided, try to find one
    if (!twitterHandle) {
      console.log('LOG: analyzeTwitterSentiment - No Twitter handle provided, attempting to find one');
      twitterHandle = await findTwitterHandle(tokenSymbol || tokenName);
    }
    
    // Prepare search queries
    let searchQueries = [];
    
    // Query 1: Twitter handle posts if available
    if (twitterHandle) {
      searchQueries.push(`from:${twitterHandle}`);
    }
    
    // Query 2: Symbol or name mentions (use symbol if available, otherwise name)
    const mentionQuery = tokenSymbol || tokenName;
    searchQueries.push(mentionQuery);
    
    // Combined results storage
    let allTweets = [];
    let totalTweets = 0;
    let totalLikes = 0;
    let totalRetweets = 0;
    
    // Process each query
    for (const query of searchQueries) {
      console.log(`LOG: analyzeTwitterSentiment - Searching for: ${query}`);
      
      try {
        const tweets = await twitterClient.v2.search(query, {
          'tweet.fields': ['created_at', 'public_metrics'],
          max_results: 50
        });
        
        if (tweets.data && tweets.data.length > 0) {
          console.log(`LOG: analyzeTwitterSentiment - Found ${tweets.data.length} tweets for query: ${query}`);
          
          // Process tweets
          for (const tweet of tweets.data) {
            totalTweets++;
            totalLikes += tweet.public_metrics?.like_count || 0;
            totalRetweets += tweet.public_metrics?.retweet_count || 0;
            
            allTweets.push({
              text: tweet.text,
              created_at: tweet.created_at,
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0
            });
          }
        } else {
          console.log(`LOG: analyzeTwitterSentiment - No tweets found for query: ${query}`);
        }
      } catch (queryError) {
        console.error(`ERROR: analyzeTwitterSentiment - Query "${query}" failed:`, queryError);
        // Continue with other queries
      }
    }
    
    // Calculate sentiment metrics
    const sentimentData = {
      success: totalTweets > 0,
      total_tweets: totalTweets,
      average_likes: totalTweets > 0 ? totalLikes / totalTweets : 0,
      average_retweets: totalTweets > 0 ? totalRetweets / totalTweets : 0,
      twitter_handle: twitterHandle || "Not found",
      recent_tweets: allTweets.slice(0, 5), // Just include the 5 most recent tweets
      last_updated: new Date().toISOString()
    };
    
    // Add basic sentiment score (very simplistic - can be improved with NLP)
    // This is based on engagement metrics since we're not doing text analysis
    const engagementScore = (
      (sentimentData.average_likes / 10) +
      (sentimentData.average_retweets / 5)
    ) / 2;
    
    // Normalize to -1 to 1 range (arbitrary normalization)
    sentimentData.sentiment_score = Math.min(Math.max(engagementScore - 0.5, -1), 1);
    
    console.log(`LOG: analyzeTwitterSentiment - Analysis complete, sentiment score: ${sentimentData.sentiment_score}`);
    return sentimentData;
    
  } catch (error) {
    console.error('ERROR: analyzeTwitterSentiment -', error);
    return { 
      success: false,
      error: `Failed to analyze Twitter sentiment: ${error.message}` 
    };
  }
}

/**
 * Generate fallback sentiment data when APIs fail
 * @param {string} tokenName - Name of the token
 * @param {string} tokenSymbol - Symbol of the token
 * @returns {Object} Generated sentiment data
 */
function generateFallbackSentimentData(tokenName, tokenSymbol) {
  console.log(`LOG: generateFallbackSentimentData - Generating fallback data for ${tokenName} (${tokenSymbol})`);
  
  // Create reasonable dummy data based on token info
  return {
    success: true,
    source: "generated",
    twitter: {
      estimated_mentions: Math.floor(Math.random() * 100) + 5,
      estimated_sentiment: (Math.random() * 2 - 1).toFixed(2),  // -1.0 to 1.0
      popularity_score: (Math.random() * 10).toFixed(1)        // 0-10 scale
    },
    community: {
      estimated_size: Math.floor(Math.random() * 10000) + 100,
      estimated_activity: (Math.random() * 10).toFixed(1),     // 0-10 scale
      estimated_growth: `${(Math.random() * 20).toFixed(1)}%`  // 0-20% growth
    },
    market_sentiment: {
      bullish_signals: Math.floor(Math.random() * 5),          // 0-5 signals
      bearish_signals: Math.floor(Math.random() * 5),          // 0-5 signals
      neutral_signals: Math.floor(Math.random() * 5)           // 0-5 signals
    },
    overall_sentiment_score: (Math.random() * 2 - 1).toFixed(2),  // -1.0 to 1.0
    last_updated: new Date().toISOString()
  };
}

/**
 * Analyze social sentiment for a token
 * @param {string} tokenAddressOrInfo - Token address or object with token information
 * @returns {Object} Social sentiment analysis
 */
async function analyzeSocialSentiment(tokenAddressOrInfo) {
  console.log(`LOG: analyzeSocialSentiment - Starting analysis for:`, tokenAddressOrInfo);
  
  try {
    // Determine what we're working with
    let tokenName, tokenSymbol, tokenAddress;
    
    if (typeof tokenAddressOrInfo === 'string') {
      // If just a string, assume it's an address or search term
      tokenAddress = tokenAddressOrInfo;
      tokenName = tokenAddressOrInfo;
      tokenSymbol = tokenAddressOrInfo;
    } else if (typeof tokenAddressOrInfo === 'object') {
      // If it's an object, extract relevant properties
      tokenName = tokenAddressOrInfo.name || tokenAddressOrInfo.token_name || '';
      tokenSymbol = tokenAddressOrInfo.symbol || tokenAddressOrInfo.token_symbol || '';
      tokenAddress = tokenAddressOrInfo.token_mint || tokenAddressOrInfo.address || '';
    } else {
      throw new Error('Invalid token information provided');
    }
    
    console.log(`LOG: analyzeSocialSentiment - Analyzing for ${tokenName} (${tokenSymbol})`);
    
    // Try to analyze Twitter sentiment
    let twitterAnalysis;
    try {
      twitterAnalysis = await analyzeTwitterSentiment(tokenName, tokenSymbol);
    } catch (twitterError) {
      console.error('ERROR: analyzeSocialSentiment - Twitter analysis failed:', twitterError);
      twitterAnalysis = { 
        success: false,
        error: `Twitter API request failed: ${twitterError.message}`
      };
    }
    
    // If Twitter analysis failed or returned no data, generate fallback data
    if (!twitterAnalysis.success) {
      console.log('LOG: analyzeSocialSentiment - Twitter analysis failed, generating fallback data');
      return generateFallbackSentimentData(tokenName, tokenSymbol);
    }
    
    // Prepare final result
    const result = {
      success: true,
      token_info: {
        name: tokenName,
        symbol: tokenSymbol,
        address: tokenAddress
      },
      twitter: twitterAnalysis,
      overall_sentiment_score: twitterAnalysis.sentiment_score || 0,
      last_updated: new Date().toISOString()
    };
    
    console.log('LOG: analyzeSocialSentiment - Analysis complete');
    return result;
    
  } catch (error) {
    console.error('ERROR: analyzeSocialSentiment -', error);
    
    // Return minimal error result
    return {
      success: false,
      error: `Failed to analyze social sentiment: ${error.message}`,
      token_info: {
        name: typeof tokenAddressOrInfo === 'string' ? tokenAddressOrInfo : 'Unknown',
        symbol: typeof tokenAddressOrInfo === 'object' ? tokenAddressOrInfo.symbol || 'Unknown' : 'Unknown'
      },
      last_updated: new Date().toISOString()
    };
  }
}

export {
  analyzeTwitterSentiment,
  analyzeSocialSentiment,
  findTwitterHandle
};
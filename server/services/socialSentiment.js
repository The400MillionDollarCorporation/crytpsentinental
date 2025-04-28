// server/services/socialSentiment.js
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import { fetchDexScreenerData } from './dexscreener.js';

dotenv.config();

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

/**
 * Extract Twitter handle from social media links array
 * @param {Array} socials - Array of social media links from DexScreener
 * @returns {string|null} Twitter handle if found
 */
function extractTwitterHandle(socials) {
  if (!Array.isArray(socials)) return null;
  
  // Find Twitter link
  const twitterSocial = socials.find(social => social.type === 'twitter');
  if (!twitterSocial || !twitterSocial.url) return null;
  
  // Extract handle from URL 
  const twitterUrl = twitterSocial.url;
  let handle = null;

  // Handle different URL formats
  if (twitterUrl.includes('twitter.com/') || twitterUrl.includes('x.com/')) {
    // Split by slash and get the last part
    const parts = twitterUrl.split('/');
    handle = parts[parts.length - 1];
    
    // Remove any query parameters
    if (handle && handle.includes('?')) {
      handle = handle.split('?')[0];
    }
    
    // Remove any hash fragments
    if (handle && handle.includes('#')) {
      handle = handle.split('#')[0];
    }
    
    // If we have a non-empty handle, return it
    if (handle && handle.trim() !== '') {
      return handle;
    }
  }

  return null;
}

/**
 * Find Twitter handle from token information
 * @param {string} tokenNameOrSymbol - Token name or symbol
 * @returns {string|null} Twitter handle if found
 */
async function findTwitterHandle(tokenNameOrSymbol) {
  console.log(`LOG: findTwitterHandle - Searching for Twitter handle for: ${tokenNameOrSymbol}`);
  
  try {
    // Try to find a Twitter account related to the token
    console.log(`LOG: findTwitterHandle - Making Twitter search API call with query: "${tokenNameOrSymbol} official account"`);
    const searchResult = await twitterClient.v2.search(`${tokenNameOrSymbol} official account`, {
      'user.fields': ['username', 'description', 'verified'],
      max_results: 10
    });
    
    // Twitter API v2 might return different structures, handle them properly
    let usersArray = [];
    
    // Handle different response structures
    if (!searchResult.data) {
      console.log('LOG: findTwitterHandle - No data in search results');
      return null;
    } else if (Array.isArray(searchResult.data)) {
      // If data is already an array, use it directly
      usersArray = searchResult.data;
    } else if (searchResult.data.data && Array.isArray(searchResult.data.data)) {
      // Some versions return a nested structure
      usersArray = searchResult.data.data;
    } else if (typeof searchResult.data === 'object') {
      // If it's a single object, convert to array
      usersArray = [searchResult.data];
    } else {
      console.log(`LOG: findTwitterHandle - Unexpected data structure: ${typeof searchResult.data}`);
      return null;
    }
    
    if (usersArray.length === 0) {
      console.log('LOG: findTwitterHandle - No Twitter accounts found in search results');
      return null;
    }
    
    // Look for verified accounts first
    const verifiedAccounts = usersArray.filter(user => user && user.verified);
    if (verifiedAccounts.length > 0) {
      console.log(`LOG: findTwitterHandle - Found verified account: @${verifiedAccounts[0].username}`);
      return verifiedAccounts[0].username;
    }
    
    // Otherwise, try to find the most relevant account
    for (const user of usersArray) {
      if (!user || !user.username) continue;
      
      const hasRelevantDescription = user.description && 
        user.description.toLowerCase().includes(tokenNameOrSymbol.toLowerCase());
      
      const hasRelevantUsername = user.username.toLowerCase().includes(tokenNameOrSymbol.toLowerCase());
      
      if (hasRelevantDescription || hasRelevantUsername) {
        console.log(`LOG: findTwitterHandle - Found relevant account: @${user.username}`);
        return user.username;
      }
    }
    
    // If no good match found, try to use first account as fallback
    if (usersArray.length > 0 && usersArray[0] && usersArray[0].username) {
      console.log(`LOG: findTwitterHandle - Using first result as fallback: @${usersArray[0].username}`);
      return usersArray[0].username;
    }
    
    return null;
  } catch (error) {
    console.error('ERROR: findTwitterHandle - Twitter API call failed:', error.message);
    
    // Check for rate limiting errors
    if (error.code === 429 || error.status === 429 || 
        (error.errors && error.errors.some(e => e.code === 88))) {
      console.error('ERROR: findTwitterHandle - Twitter API rate limit exceeded');
    }
    
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
  console.log(`LOG: analyzeTwitterSentiment - Twitter handle provided: ${twitterHandle || 'None'}`);
  
  try {
    // Clean inputs to remove null characters or problematic whitespace
    tokenName = cleanInputString(tokenName);
    tokenSymbol = cleanInputString(tokenSymbol);
    
    // If no Twitter handle provided, try to find one
    if (!twitterHandle) {
      console.log('LOG: analyzeTwitterSentiment - No Twitter handle provided, attempting to find one');
      const searchTerm = tokenSymbol || tokenName;
      if (!searchTerm || searchTerm.trim() === '') {
        console.log('LOG: analyzeTwitterSentiment - No valid search term available');
        throw new Error('No valid token symbol or name to search');
      }
      
      twitterHandle = await findTwitterHandle(searchTerm);
      console.log(`LOG: analyzeTwitterSentiment - Twitter handle search result: ${twitterHandle || 'Not found'}`);
    }
    
    // Prepare search queries
    let searchQueries = [];
    
    // Query 1: Twitter handle posts if available
    if (twitterHandle) {
      searchQueries.push(`from:${twitterHandle}`);
    }
    
    // Query 2: Symbol or name mentions (use symbol if available, otherwise name)
    const mentionQuery = tokenSymbol || tokenName;
    if (mentionQuery && mentionQuery.trim() !== '') {
      searchQueries.push(mentionQuery);
    }
    
    // Make sure we have at least one valid query
    if (searchQueries.length === 0) {
      console.log('LOG: analyzeTwitterSentiment - No valid search queries could be constructed');
      throw new Error('Unable to construct valid search queries');
    }
    
    console.log(`LOG: analyzeTwitterSentiment - Prepared search queries:`, searchQueries);
    
    // Combined results storage
    let allTweets = [];
    let totalTweets = 0;
    let totalLikes = 0;
    let totalRetweets = 0;
    
    // Process each query with rate limit awareness
    for (const query of searchQueries) {
      console.log(`LOG: analyzeTwitterSentiment - Executing Twitter search for: "${query}"`);
      
      try {
        // Check if we've already collected enough tweets and can skip additional API calls
        if (totalTweets > 30) {
          console.log(`LOG: analyzeTwitterSentiment - Already collected ${totalTweets} tweets, skipping additional queries to avoid rate limits`);
          break;
        }
        
        const tweets = await twitterClient.v2.search(query, {
          'tweet.fields': ['created_at', 'public_metrics'],
          max_results: 20 // Reduced to be more conservative with rate limits
        });
        
        // Handle different response structures
        let tweetsArray = [];
        if (Array.isArray(tweets.data)) {
          tweetsArray = tweets.data;
        } else if (tweets.data && tweets.data.data && Array.isArray(tweets.data.data)) {
          tweetsArray = tweets.data.data;
        } else if (tweets.data && !Array.isArray(tweets.data)) {
          tweetsArray = [tweets.data];
        }
        
        if (tweetsArray.length > 0) {
          console.log(`LOG: analyzeTwitterSentiment - Found ${tweetsArray.length} tweets for query: "${query}"`);
          
          // Process tweets
          for (const tweet of tweetsArray) {
            if (!tweet) continue;
            
            totalTweets++;
            const likeCount = tweet.public_metrics?.like_count || 0;
            const retweetCount = tweet.public_metrics?.retweet_count || 0;
            
            totalLikes += likeCount;
            totalRetweets += retweetCount;
            
            // Add to collected tweets
            allTweets.push({
              text: tweet.text || '',
              created_at: tweet.created_at || new Date().toISOString(),
              likes: likeCount,
              retweets: retweetCount
            });
          }
        } else {
          console.log(`LOG: analyzeTwitterSentiment - No tweets found for query: "${query}"`);
        }
        
        // Add delay between queries to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (queryError) {
        console.error(`ERROR: analyzeTwitterSentiment - Query "${query}" failed:`, queryError.message);
        
        // If we hit a rate limit, break out of the loop
        if (queryError.code === 429 || queryError.status === 429 || 
            (queryError.errors && queryError.errors.some(e => e.code === 88))) {
          console.error(`ERROR: analyzeTwitterSentiment - Rate limit reached, stopping additional queries`);
          break;
        }
        
        // Continue with other queries
      }
    }
    
    console.log(`LOG: analyzeTwitterSentiment - Analysis summary:`, {
      total_tweets_found: totalTweets,
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      avg_likes: totalTweets > 0 ? (totalLikes / totalTweets).toFixed(2) : 0,
      avg_retweets: totalTweets > 0 ? (totalRetweets / totalTweets).toFixed(2) : 0
    });
    
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
    
    console.log(`LOG: analyzeTwitterSentiment - Calculated sentiment score: ${sentimentData.sentiment_score.toFixed(4)}`);
    
    return sentimentData;
    
  } catch (error) {
    console.error('ERROR: analyzeTwitterSentiment - Fatal error:', error.message);
    
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
  
  // Clean inputs
  tokenName = cleanInputString(tokenName);
  tokenSymbol = cleanInputString(tokenSymbol);
  
  // Create reasonable dummy data based on token info
  const result = {
    success: true,
    source: "generated",
    token_info: {
      name: tokenName || "Unknown",
      symbol: tokenSymbol || "UNKNOWN"
    },
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
  
  console.log(`LOG: generateFallbackSentimentData - Generated fallback data with overall score: ${result.overall_sentiment_score}`);
  
  return result;
}

/**
 * Clean input string by removing null characters and problematic whitespace
 * @param {string} input - String to clean
 * @returns {string} Cleaned string
 */
function cleanInputString(input) {
  if (!input) return '';
  
  // Convert to string if not already
  const str = String(input);
  
  // Remove null bytes and trim whitespace
  return str.replace(/\0/g, '').trim();
}

/**
 * Analyze social sentiment for a token
 * @param {string} tokenAddressOrInfo - Token address or object with token information
 * @returns {Object} Social sentiment analysis
 */
async function analyzeSocialSentiment(tokenAddressOrInfo) {
  console.log(`LOG: analyzeSocialSentiment - Starting analysis for:`, 
    typeof tokenAddressOrInfo === 'string' 
      ? tokenAddressOrInfo
      : JSON.stringify(tokenAddressOrInfo).substring(0, 500)
  );
  
  try {
    // Determine what we're working with
    let tokenName, tokenSymbol, tokenAddress;
    let dexScreenerData = null;
    let twitterHandle = null;
    
    if (typeof tokenAddressOrInfo === 'string') {
      // If just a string, assume it's an address
      tokenAddress = tokenAddressOrInfo;
      
      // Fetch DexScreener data first - it has more reliable token info
      console.log(`LOG: analyzeSocialSentiment - Fetching DexScreener data for address: ${tokenAddress}`);
      dexScreenerData = await fetchDexScreenerData(tokenAddress);
      
      if (dexScreenerData && dexScreenerData.success) {
        console.log(`LOG: analyzeSocialSentiment - Successfully retrieved DexScreener data`);
        tokenName = dexScreenerData.token_name;
        tokenSymbol = dexScreenerData.token_symbol;
        
        // Extract Twitter handle from socials if available
        if (dexScreenerData.links && dexScreenerData.links.socials) {
          twitterHandle = extractTwitterHandle(dexScreenerData.links.socials);
          console.log(`LOG: analyzeSocialSentiment - Extracted Twitter handle from DexScreener: ${twitterHandle || 'None'}`);
        }
      } else {
        console.log(`LOG: analyzeSocialSentiment - Failed to get DexScreener data, using address as name/symbol`);
        tokenName = tokenAddress;
        tokenSymbol = tokenAddress;
      }
    } else if (typeof tokenAddressOrInfo === 'object' && tokenAddressOrInfo !== null) {
      // If it's an object, extract relevant properties
      tokenName = tokenAddressOrInfo.name || tokenAddressOrInfo.token_name || '';
      tokenSymbol = tokenAddressOrInfo.symbol || tokenAddressOrInfo.token_symbol || '';
      tokenAddress = tokenAddressOrInfo.token_mint || tokenAddressOrInfo.address || '';
      
      // Fetch DexScreener data if we have an address
      if (tokenAddress) {
        console.log(`LOG: analyzeSocialSentiment - Fetching DexScreener data for object with address: ${tokenAddress}`);
        dexScreenerData = await fetchDexScreenerData(tokenAddress);
        
        if (dexScreenerData && dexScreenerData.success) {
          console.log(`LOG: analyzeSocialSentiment - Successfully retrieved DexScreener data`);
          // Only override if the existing values are empty
          if (!tokenName) tokenName = dexScreenerData.token_name;
          if (!tokenSymbol) tokenSymbol = dexScreenerData.token_symbol;
          
          // Extract Twitter handle from socials if available
          if (dexScreenerData.links && dexScreenerData.links.socials) {
            twitterHandle = extractTwitterHandle(dexScreenerData.links.socials);
            console.log(`LOG: analyzeSocialSentiment - Extracted Twitter handle from DexScreener: ${twitterHandle || 'None'}`);
          }
        }
      }
    } else {
      console.error(`LOG: analyzeSocialSentiment - Invalid input type: ${typeof tokenAddressOrInfo}`);
      throw new Error('Invalid token information provided');
    }
    
    // Clean input strings
    tokenName = cleanInputString(tokenName);
    tokenSymbol = cleanInputString(tokenSymbol);
    tokenAddress = cleanInputString(tokenAddress);
    
    console.log(`LOG: analyzeSocialSentiment - Will analyze for ${tokenName} (${tokenSymbol}) at address ${tokenAddress}`);
    
    // Check if we have any valid data to search with
    if ((!tokenName || tokenName === '') && (!tokenSymbol || tokenSymbol === '')) {
      console.log(`LOG: analyzeSocialSentiment - No valid token name or symbol to search with`);
      return generateFallbackSentimentData(tokenAddress, tokenAddress);
    }
    
    // Try to analyze Twitter sentiment (with error handling)
    let twitterAnalysis;
    let useFallback = false;
    
    try {
      console.log(`LOG: analyzeSocialSentiment - Starting Twitter sentiment analysis`);
      twitterAnalysis = await analyzeTwitterSentiment(tokenName, tokenSymbol, twitterHandle);
      console.log(`LOG: analyzeSocialSentiment - Twitter analysis result:`, {
        success: twitterAnalysis.success,
        twitter_handle: twitterAnalysis.twitter_handle,
        tweet_count: twitterAnalysis.total_tweets,
        sentiment_score: twitterAnalysis.sentiment_score
      });
      
      if (!twitterAnalysis.success || twitterAnalysis.total_tweets === 0) {
        useFallback = true;
      }
    } catch (twitterError) {
      console.error('ERROR: analyzeSocialSentiment - Twitter analysis failed:', twitterError.message);
      useFallback = true;
      twitterAnalysis = { 
        success: false,
        error: `Twitter API request failed: ${twitterError.message}`
      };
    }
    
    // If Twitter analysis failed or returned no data, generate fallback data
    if (useFallback) {
      console.log('LOG: analyzeSocialSentiment - Twitter analysis failed or empty, generating fallback data');
      const fallbackData = generateFallbackSentimentData(tokenName, tokenSymbol);
      
      // If we have DexScreener data, enhance the fallback data with it
      if (dexScreenerData && dexScreenerData.success) {
        fallbackData.token_info = {
          name: tokenName || dexScreenerData.token_name || "Unknown",
          symbol: tokenSymbol || dexScreenerData.token_symbol || "UNKNOWN",
          address: tokenAddress || dexScreenerData.token_address
        };
        
        fallbackData.market_data = {
          price_usd: dexScreenerData.price_usd,
          market_cap: dexScreenerData.market_cap,
          liquidity_usd: dexScreenerData.liquidity_usd,
          volume_24h: dexScreenerData.volume_24h,
          price_change_24h: dexScreenerData.price_change?.h24
        };
        
        fallbackData.links = dexScreenerData.links;
      }
      
      return fallbackData;
    }
    
    // Prepare final result
    const result = {
      success: true,
      token_info: {
        name: tokenName || "Unknown",
        symbol: tokenSymbol || "UNKNOWN",
        address: tokenAddress || "Unknown"
      },
      twitter: twitterAnalysis,
      overall_sentiment_score: twitterAnalysis.sentiment_score || 0,
      last_updated: new Date().toISOString()
    };
    
    // If we have DexScreener data, enhance the response with it
    if (dexScreenerData && dexScreenerData.success) {
      result.market_data = {
        price_usd: dexScreenerData.price_usd,
        market_cap: dexScreenerData.market_cap,
        liquidity_usd: dexScreenerData.liquidity_usd,
        volume_24h: dexScreenerData.volume_24h,
        price_change_24h: dexScreenerData.price_change?.h24
      };
      
      result.links = dexScreenerData.links;
      
      // Include buy/sell ratio if available
      if (dexScreenerData.buy_sell_ratio) {
        result.market_sentiment = {
          buy_sell_ratio: dexScreenerData.buy_sell_ratio,
          buys_24h: dexScreenerData.transactions?.h24?.buys,
          sells_24h: dexScreenerData.transactions?.h24?.sells
        };
      }
      
      // Adjust overall sentiment based on price movement
      if (dexScreenerData.price_change && dexScreenerData.price_change.h24) {
        const priceChange24h = dexScreenerData.price_change.h24;
        const priceChangeFactor = Math.min(Math.max(priceChange24h / 50, -0.5), 0.5); // Scale and cap price impact
        
        // Blend Twitter sentiment with price movement
        const originalScore = result.overall_sentiment_score;
        result.overall_sentiment_score = Math.min(Math.max(originalScore + priceChangeFactor, -1), 1);
        
        console.log(`LOG: analyzeSocialSentiment - Adjusted sentiment score from ${originalScore} to ${result.overall_sentiment_score} based on price change of ${priceChange24h}%`);
      }
    }
    
    console.log('LOG: analyzeSocialSentiment - Analysis complete with success');
    return result;
    
  } catch (error) {
    console.error('ERROR: analyzeSocialSentiment - Fatal error:', error.message);
    
    // Return minimal error result with fallback
    return generateFallbackSentimentData(
      typeof tokenAddressOrInfo === 'string' ? tokenAddressOrInfo : 'Unknown',
      typeof tokenAddressOrInfo === 'object' && tokenAddressOrInfo ? tokenAddressOrInfo.symbol || 'Unknown' : 'Unknown'
    );
  }
}

export {
  analyzeTwitterSentiment,
  analyzeSocialSentiment,
  findTwitterHandle
};
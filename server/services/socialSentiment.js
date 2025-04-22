// server/services/socialSentiment.js
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
dotenv.config();

// Then log to verify they're loaded:
console.log("Twitter API Key:", process.env.TWITTER_API_KEY ? "Found" : "Missing");

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

/**
 * Analyzes Twitter sentiment for a project
 * @param {string} projectName - Name of the project to analyze
 * @param {string} twitterHandle - Optional Twitter handle
 * @returns {Object} Twitter sentiment analysis
 */
async function analyzeTwitterSentiment(projectName, twitterHandle = null) {
  try {
    // Search for tweets about the project
    const searchQuery = twitterHandle 
      ? `from:${twitterHandle}`
      : projectName;
    
    const tweets = await twitterClient.v2.search(searchQuery, {
      'tweet.fields': ['created_at', 'public_metrics', 'sentiment'],
      max_results: 100
    });

    // Calculate sentiment metrics
    const sentimentData = {
      total_tweets: tweets.data.length,
      average_likes: 0,
      average_retweets: 0,
      sentiment_score: 0,
      recent_activity: []
    };

    // Process tweets
    for (const tweet of tweets.data) {
      sentimentData.average_likes += tweet.public_metrics.like_count;
      sentimentData.average_retweets += tweet.public_metrics.retweet_count;
      
      // Add to recent activity
      sentimentData.recent_activity.push({
        text: tweet.text,
        created_at: tweet.created_at,
        likes: tweet.public_metrics.like_count,
        retweets: tweet.public_metrics.retweet_count
      });
    }

    // Calculate averages
    if (tweets.data.length > 0) {
      sentimentData.average_likes /= tweets.data.length;
      sentimentData.average_retweets /= tweets.data.length;
    }

    return sentimentData;
  } catch (error) {
    console.error('Error analyzing Twitter sentiment:', error);
    return { error: `Failed to analyze Twitter sentiment: ${error.message}` };
  }
}

/**
 * Analyzes Discord community metrics
 * @param {string} discordServerId - Discord server ID
 * @returns {Object} Discord community analysis
 */
async function analyzeDiscordMetrics(discordServerId) {
  try {
    // Note: This would require Discord API integration
    // For now, we'll return a placeholder structure
    return {
      server_id: discordServerId,
      member_count: 'N/A', // Would be fetched from Discord API
      active_members: 'N/A',
      message_activity: 'N/A',
      channels: 'N/A',
      error: 'Discord API integration not implemented'
    };
  } catch (error) {
    console.error('Error analyzing Discord metrics:', error);
    return { error: `Failed to analyze Discord metrics: ${error.message}` };
  }
}

/**
 * Comprehensive social sentiment analysis
 * @param {Object} projectInfo - Project information
 * @returns {Object} Complete social sentiment analysis
 */
async function analyzeSocialSentiment(projectInfo) {
  try {
    const twitterAnalysis = await analyzeTwitterSentiment(
      projectInfo.name,
      projectInfo.twitterHandle
    );

    const discordAnalysis = await analyzeDiscordMetrics(
      projectInfo.discordServerId
    );

    return {
      twitter: twitterAnalysis,
      discord: discordAnalysis,
      overall_sentiment: {
        score: calculateOverallSentiment(twitterAnalysis, discordAnalysis),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error in social sentiment analysis:', error);
    return { error: `Failed to analyze social sentiment: ${error.message}` };
  }
}

/**
 * Calculates overall sentiment score
 * @param {Object} twitterData - Twitter analysis data
 * @param {Object} discordData - Discord analysis data
 * @returns {number} Overall sentiment score
 */
function calculateOverallSentiment(twitterData, discordData) {
  // Simple weighted average calculation
  // This can be made more sophisticated based on specific metrics
  let score = 0;
  let weight = 0;

  if (twitterData && !twitterData.error) {
    // Twitter weight: 0.7
    const twitterScore = (
      (twitterData.average_likes / 100) +
      (twitterData.average_retweets / 50)
    ) / 2;
    score += twitterScore * 0.7;
    weight += 0.7;
  }

  if (discordData && !discordData.error) {
    // Discord weight: 0.3
    // This would be calculated based on actual Discord metrics
    const discordScore = 0.5; // Placeholder
    score += discordScore * 0.3;
    weight += 0.3;
  }

  return weight > 0 ? score / weight : 0;
}

export {
  analyzeTwitterSentiment,
  analyzeDiscordMetrics,
  analyzeSocialSentiment
}; 
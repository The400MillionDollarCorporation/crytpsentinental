// server/agents/researchBot.js
import { ChatOpenAI } from '@langchain/openai';
// import { fetchDexScreenerData } from '../../services/dexscreener.js';
import { fetchDexScreenerData } from '../services/dexscreener.js';
import axios from 'axios';
import { parse } from 'url';

// Import services
import { 
  analyzeSolanaProgram, 
} from '../services/solanaProgram.js';

// Import social sentiment analysis service 
import { analyzeSocialSentiment } from '../services/socialSentiment.js';

// Import on-chain metrics analysis service
import { analyzeOnChainMetrics } from '../services/onChainMetrics.js';

/**
 * Agent state class to manage conversation and analysis state
 */
class AgentState {
  constructor() {
    this.messages = [];
    this.contractData = null;
    this.tokenData = null;
    this.socialData = null;
    this.onChainData = null;  // Add new field for on-chain metrics
    this.currentStep = 'start';
    this.finalAnalysis = null;
    this.inputType = null;
    this.contractAddress = null;
    this.projectName = null;
    this.errors = [];
    this.conversationHistory = [];
    this.context = {};
    this.tradingDecision = null;
    this.tradingResult = null;
  }

  /**
   * Add entry to conversation history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addToHistory(role, content) {
    console.log(`LOG: AgentState.addToHistory - Adding ${role} message to history, length: ${content.length} chars`);
    this.conversationHistory.push({
      role,
      content
    });
  }
}

/**
 * Main research bot class that orchestrates the analysis workflow
 */
class ResearchBot {
  constructor() {
    console.log('LOG: ResearchBot constructor - Initializing with ChatOpenAI');
    this.llm = new ChatOpenAI({
      temperature: 0,
      modelName: "gpt-4"
    });
    this.state = null;
    console.log('LOG: ResearchBot constructor - Initialization complete');
  }

  /**
   * Analyze user input to determine what type of query it is
   * @param {string} inputText - User's query
   * @returns {Object} Analysis results including type and value
   */
  async analyzeUserInput(inputText) {
    console.log('LOG: analyzeUserInput - Starting analysis of:', inputText);
    
    // Patterns for validation
    const solanaAddressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    const tokenPrefix = /token:([1-9A-HJ-NP-Za-km-z]{32,44})/;
    
    try {
      // Check for token: prefix
      console.log('LOG: analyzeUserInput - Checking for token prefix');
      const tokenMatch = inputText.match(tokenPrefix);
      if (tokenMatch) {
        console.log(`LOG: analyzeUserInput - Found token prefix, value: ${tokenMatch[1]}`);
        return { 
          type: 'contract_address', 
          value: tokenMatch[1], 
          confidence: 'high'
        };
      }
      
      // Check for Solana address
      console.log('LOG: analyzeUserInput - Checking for Solana address');
      const solanaMatch = inputText.match(solanaAddressPattern);
      
      if (solanaMatch) {
        console.log(`LOG: analyzeUserInput - Found Solana address: ${solanaMatch[0]}`);
        return { 
          type: 'contract_address', 
          value: solanaMatch[0], 
          confidence: 'high'
        };
      }
      
      // If no matches, treat as project name
      console.log(`LOG: analyzeUserInput - No specific pattern matched, treating as project name: ${inputText.trim()}`);
      return { 
        type: 'project_name', 
        value: inputText.trim(), 
        confidence: 'medium'
      };
    } catch (error) {
      console.error('ERROR: analyzeUserInput -', error);
      return { 
        type: 'project_name', 
        value: inputText.trim(), 
        confidence: 'low'
      };
    }
  }
  /**
   * Analyzes transaction data to provide detailed insights
   * @param {Object} transactions - Transaction data from DexScreener
   * @returns {Object} Structured transaction analysis
   */
  analyzeTransactionData(transactions) {
    console.log('LOG: analyzeTransactionData - Starting transaction analysis');
    
    if (!transactions) {
      console.log('LOG: analyzeTransactionData - No transaction data available');
      return {
        rating: 0,
        buy_sell_ratio: 0,
        comment: "No transaction data available for analysis",
        "24h_transactions": { buys: 0, sells: 0, total: 0 },
        "6h_transactions": { buys: 0, sells: 0, total: 0 },
        "1h_transactions": { buys: 0, sells: 0, total: 0 },
        "5m_transactions": { buys: 0, sells: 0, total: 0 },
        "transaction_trend": "Unknown",
        "transaction_velocity": "Unknown",
        "analysis_confidence": "Low"
      };
    }
    
    try {
      // Extract transaction data for different time periods
      const h24 = transactions.h24 || { buys: 0, sells: 0, total: 0 };
      const h6 = transactions.h6 || { buys: 0, sells: 0, total: 0 };
      const h1 = transactions.h1 || { buys: 0, sells: 0, total: 0 };
      const m5 = transactions.m5 || { buys: 0, sells: 0, total: 0 };
      
      console.log('LOG: analyzeTransactionData - Extracted transaction data for different time periods');
      
      // Calculate buy/sell ratios for different time periods
      const buyRatio24h = h24.sells > 0 ? (h24.buys / h24.sells).toFixed(2) : (h24.buys > 0 ? "∞" : "0");
      const buyRatio6h = h6.sells > 0 ? (h6.buys / h6.sells).toFixed(2) : (h6.buys > 0 ? "∞" : "0");
      const buyRatio1h = h1.sells > 0 ? (h1.buys / h1.sells).toFixed(2) : (h1.buys > 0 ? "∞" : "0");
      const buyRatio5m = m5.sells > 0 ? (m5.buys / m5.sells).toFixed(2) : (m5.buys > 0 ? "∞" : "0");
      
      console.log('LOG: analyzeTransactionData - Calculated buy/sell ratios');
      
      // Determine transaction trend
      let trend = "Stable";
      if (h24.total > 0) {
        const h24HourlyRate = h24.total / 24; // Avg transactions per hour over 24h
        const h1HourlyRate = h1.total;        // Last hour rate
        
        if (h1HourlyRate > h24HourlyRate * 1.5) {
          trend = "Strongly Increasing";
        } else if (h1HourlyRate > h24HourlyRate * 1.2) {
          trend = "Moderately Increasing";
        } else if (h1HourlyRate < h24HourlyRate * 0.5) {
          trend = "Strongly Decreasing";
        } else if (h1HourlyRate < h24HourlyRate * 0.8) {
          trend = "Moderately Decreasing";
        }
      }
      
      console.log(`LOG: analyzeTransactionData - Determined transaction trend: ${trend}`);
      
      // Determine buy/sell pressure trend
      let buyPressureTrend = "Neutral";
      if (parseFloat(buyRatio24h) > 0 && parseFloat(buyRatio1h) > 0) {
        if (parseFloat(buyRatio1h) > parseFloat(buyRatio24h) * 1.3) {
          buyPressureTrend = "Strongly Bullish";
        } else if (parseFloat(buyRatio1h) > parseFloat(buyRatio24h) * 1.1) {
          buyPressureTrend = "Moderately Bullish";
        } else if (parseFloat(buyRatio1h) < parseFloat(buyRatio24h) * 0.7) {
          buyPressureTrend = "Strongly Bearish";
        } else if (parseFloat(buyRatio1h) < parseFloat(buyRatio24h) * 0.9) {
          buyPressureTrend = "Moderately Bearish";
        }
      }
      
      console.log(`LOG: analyzeTransactionData - Determined buy pressure trend: ${buyPressureTrend}`);
      
      // Calculate transaction velocity (transactions per hour)
      const velocityLast24h = (h24.total / 24).toFixed(2);
      const velocityLast6h = (h6.total / 6).toFixed(2);
      const velocityLast1h = h1.total;
      
      console.log(`LOG: analyzeTransactionData - Calculated transaction velocities: 24h=${velocityLast24h}/hr, 6h=${velocityLast6h}/hr, 1h=${velocityLast1h}/hr`);
      
      // Determine transaction velocity trend
      let velocityTrend = "Stable";
      if (parseFloat(velocityLast1h) > parseFloat(velocityLast24h) * 1.5) {
        velocityTrend = "Rapidly Accelerating";
      } else if (parseFloat(velocityLast1h) > parseFloat(velocityLast24h) * 1.2) {
        velocityTrend = "Accelerating";
      } else if (parseFloat(velocityLast1h) < parseFloat(velocityLast24h) * 0.5) {
        velocityTrend = "Rapidly Decelerating";
      } else if (parseFloat(velocityLast1h) < parseFloat(velocityLast24h) * 0.8) {
        velocityTrend = "Decelerating";
      }
      
      console.log(`LOG: analyzeTransactionData - Determined velocity trend: ${velocityTrend}`);
      
      // Calculate rating based on transaction metrics
      let transactionRating = 5; // Default neutral rating
      
      // Adjust rating based on 24h transaction volume
      if (h24.total > 1000) transactionRating += 2;
      else if (h24.total > 500) transactionRating += 1;
      else if (h24.total < 10) transactionRating -= 2;
      else if (h24.total < 50) transactionRating -= 1;
      
      // Adjust rating based on buy/sell ratio
      const numericBuyRatio24h = parseFloat(buyRatio24h);
      if (numericBuyRatio24h > 2) transactionRating += 2;
      else if (numericBuyRatio24h > 1.3) transactionRating += 1;
      else if (numericBuyRatio24h < 0.5) transactionRating -= 2;
      else if (numericBuyRatio24h < 0.8) transactionRating -= 1;
      
      // Adjust rating based on trend
      if (trend === "Strongly Increasing") transactionRating += 1;
      else if (trend === "Strongly Decreasing") transactionRating -= 1;
      
      // Cap the rating between 0 and 10
      transactionRating = Math.max(0, Math.min(10, transactionRating));
      
      console.log(`LOG: analyzeTransactionData - Calculated transaction rating: ${transactionRating}`);
      
      // Generate analysis comment
      let comment = `Transaction analysis based on ${h24.total} transactions in the last 24 hours. `;
      
      if (h24.total > 500) {
        comment += `High transaction volume with ${velocityLast24h} transactions per hour on average. `;
      } else if (h24.total > 100) {
        comment += `Moderate transaction volume with ${velocityLast24h} transactions per hour on average. `;
      } else {
        comment += `Low transaction volume with only ${velocityLast24h} transactions per hour on average. `;
      }
      
      comment += `The buy/sell ratio over 24 hours is ${buyRatio24h}, indicating ${
        parseFloat(buyRatio24h) > 1.3 ? "strong buying pressure" : 
        parseFloat(buyRatio24h) > 1 ? "moderate buying pressure" : 
        parseFloat(buyRatio24h) === 1 ? "balanced trading" : 
        parseFloat(buyRatio24h) > 0.7 ? "moderate selling pressure" : "strong selling pressure"
      }. `;
      
      comment += `Transaction activity is ${trend.toLowerCase()} with ${buyPressureTrend.toLowerCase()} momentum.`;
      
      console.log(`LOG: analyzeTransactionData - Generated analysis comment`);
      
      // Create detailed analysis result
      return {
        rating: transactionRating,
        buy_sell_ratio: numericBuyRatio24h,
        comment: comment,
        "24h_transactions": h24,
        "6h_transactions": h6,
        "1h_transactions": h1,
        "5m_transactions": m5,
        "transaction_trend": trend,
        "buy_pressure_trend": buyPressureTrend,
        "transaction_velocity": {
          "24h_avg": velocityLast24h,
          "6h_avg": velocityLast6h,
          "1h": velocityLast1h,
          "trend": velocityTrend
        },
        "buy_sell_ratios": {
          "24h": buyRatio24h,
          "6h": buyRatio6h,
          "1h": buyRatio1h,
          "5m": buyRatio5m
        },
        "analysis_confidence": h24.total > 100 ? "High" : h24.total > 20 ? "Medium" : "Low"
      };
    } catch (error) {
      console.error('ERROR: analyzeTransactionData -', error);
      return {
        rating: 0,
        buy_sell_ratio: 0,
        comment: `Error analyzing transaction data: ${error.message}`,
        "24h_transactions": { buys: 0, sells: 0, total: 0 },
        "6h_transactions": { buys: 0, sells: 0, total: 0 },
        "1h_transactions": { buys: 0, sells: 0, total: 0 },
        "transaction_trend": "Unknown",
        "analysis_confidence": "Low",
        "error": error.message
      };
    }
  }
 /**
   * Generate comprehensive investment analysis based on collected data
   * @param {Object} contractAnalysis - Smart contract security analysis
   * @param {Object} tokenMetrics - Token market data
   * @param {Object} onChainData - On-chain metrics analysis
   * @param {Object} socialData - Social sentiment data
   * @returns {Object} Structured investment recommendation
   */

 // In the assessInvestmentPotential method in ResearchBot class
async assessInvestmentPotential(contractAnalysis, tokenMetrics, onChainData, socialData) {
  console.log('LOG: assessInvestmentPotential - Starting investment assessment');
  console.log(`LOG: assessInvestmentPotential - Data available: Contract=${!!contractAnalysis}, Token=${!!tokenMetrics}, OnChain=${!!onChainData}, Social=${!!socialData}`);
  
  try {
    // Extract market data for prompt enrichment
    let marketData = {};
    let transactions = null;
    
    // Try to get market data from onChainData first (new structure)
    if (onChainData && onChainData.market_data) {
      marketData = onChainData.market_data;
    } 
    // Fallback to liquidity_metrics if available
    else if (onChainData && onChainData.liquidity_metrics && onChainData.liquidity_metrics.success) {
      const metrics = onChainData.liquidity_metrics;
      marketData = {
        token_name: metrics.token_name,
        token_symbol: metrics.token_symbol,
        price_usd: metrics.price_usd,
        market_cap: metrics.market_cap,
        fdv: metrics.fdv,
        price_change_24h: metrics.price_change_24h
      };
    }
    
    // Get token address from available sources
    let tokenAddress = null;
    if (tokenMetrics && tokenMetrics.token_mint) {
      tokenAddress = tokenMetrics.token_mint;
    } else if (contractAnalysis && contractAnalysis.program_data && contractAnalysis.program_data.programId) {
      tokenAddress = contractAnalysis.program_data.programId;
    } else if (this.state && this.state.contractAddress) {
      tokenAddress = this.state.contractAddress;
    }
    
    // Save original transaction data for later direct inclusion
    let rawTransactions = null;
    
    // Extract transaction data from tokenMetrics if available
    if (tokenMetrics && tokenMetrics.enhanced_market_data && tokenMetrics.enhanced_market_data.transactions) {
      // Save a reference to the raw transaction data
      rawTransactions = tokenMetrics.enhanced_market_data.transactions;
      transactions = { ...rawTransactions }; // Clone to avoid mutation
      
      // Also add buy/sell ratio if available
      if (tokenMetrics.enhanced_market_data.buy_sell_ratio_24h) {
        transactions.buy_sell_ratio = tokenMetrics.enhanced_market_data.buy_sell_ratio_24h;
      }
    }
    
    // Create analysis prompt with enhanced market data and better instructions
    console.log('LOG: assessInvestmentPotential - Creating analysis prompt');
    const prompt = `You are a professional cryptocurrency analyst specializing in Solana tokens. Provide a detailed, data-driven assessment of this token based on the following information.

    TOKEN DATA FOR ANALYSIS:
    
    Token Address: ${tokenAddress || "Unknown"}
    
    Token Market Data:
    ${JSON.stringify(marketData || {}, null, 2)}
    
    Solana Program Security Analysis:
    ${JSON.stringify(contractAnalysis || {}, null, 2)}
    
    Token Metrics:
    ${JSON.stringify(tokenMetrics || {}, null, 2)}
    
    On-Chain Metrics Analysis:
    ${JSON.stringify(onChainData || {}, null, 2)}
    
    Social Sentiment Analysis:
    ${JSON.stringify(socialData || {}, null, 2)}
    
    Transaction Data:
    ${JSON.stringify(transactions || {}, null, 2)}

    ANALYSIS REQUIREMENTS:
    
    1. SMART CONTRACT RISK ASSESSMENT:
       - Rate security from 0-10 (higher is safer)
       - Specifically analyze: mint authority control, ownership concentration, code quality
       - Highlight any red flags or backdoors
       - For unknown factors, explicitly state what information is missing
       
    2. TOKEN PERFORMANCE ANALYSIS:
       - Rate performance from 0-10 (higher is better)
       - Analyze specific metrics: price movement, liquidity depth, volume
       - Compare current price to historical trends if data available
       - Include specific numerical data points, not generic statements
       
    3. ON-CHAIN METRICS EVALUATION:
       - Rate on-chain health from 0-10 (higher is better)
       - Analyze transaction patterns, whale activity, holder distribution
       - Provide specific holder counts, whale percentages, or transaction frequencies
       - Note any suspicious on-chain activities (wash trading, etc.)
       - Include buy/sell ratio analysis when available
       
    4. TRANSACTION ANALYSIS:
       - Analyze transaction counts across different time periods (24h, 6h, 1h, 5m)
       - Evaluate the buy vs sell pressure based on transaction counts
       - Calculate and interpret the buy/sell ratio
       - Note any unusual transaction patterns or potential market manipulation
       
    5. SOCIAL SENTIMENT EVALUATION:
       - Rate social sentiment from 0-10 (higher is better)
       - Include specific data points about community size or engagement if available
       - Mention specific platforms where token is discussed (Twitter, Telegram, etc.)
       - Note if sentiment data is limited or unavailable
       
    6. OVERALL INVESTMENT ASSESSMENT:
       - Calculate a risk/reward ratio (0-5 scale)
       - Provide a confidence score (0-100%)
       - Deliver a detailed, specific recommendation with timeframe considerations
       - Mention specific catalysts or risk factors unique to this token
       
    7. DO NOT USE GENERIC PHRASES like "The token shows promise" or "Further research is recommended"
       Instead, give concrete insights based on the specific data provided.
    
    8. ALWAYS INCLUDE THE TOKEN ADDRESS in your token_info section.

    OUTPUT FORMAT:
    Return your analysis as a JSON object with the following structure:
    {
      "token_info": {
        "name": "<token name>",
        "symbol": "<token symbol>",
        "address": "${tokenAddress || "Unknown"}",
        "price_usd": <price>,
        "market_cap": <market cap>,
        "fdv": <fully diluted valuation>,
        "price_change_24h": <24h price change percent>,
        "liquidity_usd": <liquidity in USD>
      },
      "smart_contract_risk": { 
        "rating": <0-10>, 
        "comment": "<detailed security analysis with specific findings>", 
        "key_risks": ["<specific risk 1>", "<specific risk 2>"],
        "error": "<error or null>" 
      },
      "token_performance": { 
        "rating": <0-10>, 
        "comment": "<detailed performance analysis with specific metrics>", 
        "key_metrics": {
          "liquidity_rating": <0-10>,
          "volume_rating": <0-10>,
          "price_stability": <0-10>
        },
        "error": "<error or null>" 
      },
      "transaction_analysis": {
        "rating": <0-10>,
        "buy_sell_ratio": <ratio>,
        "comment": "<detailed transaction analysis>",
        "24h_transactions": { "buys": <count>, "sells": <count>, "total": <count> },
        "6h_transactions": { "buys": <count>, "sells": <count>, "total": <count> },
        "1h_transactions": { "buys": <count>, "sells": <count>, "total": <count> },
        "transaction_trend": "<increasing/decreasing/stable>"
      },
      "on_chain_metrics": { 
        "rating": <0-10>, 
        "comment": "<detailed on-chain analysis with specific patterns>", 
        "holder_distribution": "<specific insight about token distribution>",
        "transaction_patterns": "<specific insight about transaction activity>",
        "error": "<error or null>" 
      },
      "social_sentiment": { 
        "rating": <0-10>, 
        "comment": "<detailed sentiment analysis with specific platforms mentioned>", 
        "community_strength": "<specific assessment of community>",
        "error": "<error or null>" 
      },
      "risk_reward_ratio": <0-5>,
      "confidence_score": <0-100>,
      "investment_timeframe": "<short/medium/long-term potential assessment>",
      "specific_catalysts": ["<catalyst 1>", "<catalyst 2>"],
      "specific_concerns": ["<concern 1>", "<concern 2>"],
      "final_recommendation": "<detailed, token-specific recommendation>",
      "timestamp": "<current ISO date>"
    }`;
    
    console.log('LOG: assessInvestmentPotential - Sending prompt to LLM');
    const response = await this.llm.predict(prompt);
    console.log(`LOG: assessInvestmentPotential - Received LLM response, length: ${response.length}`);
    
    // Parse the result - the LLM should return JSON
    let analysis;
    try {
      console.log('LOG: assessInvestmentPotential - Attempting to parse response as JSON');
      analysis = JSON.parse(response);
      console.log('LOG: assessInvestmentPotential - Successfully parsed JSON response');
    } catch (parseError) {
      console.error('ERROR: assessInvestmentPotential - JSON parse error:', parseError);
      console.log('LOG: assessInvestmentPotential - Attempting alternative JSON extraction');
      
      // If JSON parsing fails, extract JSON from the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/{[\s\S]*}/);
      if (jsonMatch) {
        console.log('LOG: assessInvestmentPotential - Found JSON match in response');
        analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        console.log('LOG: assessInvestmentPotential - Successfully parsed extracted JSON');
      } else {
        console.error('ERROR: assessInvestmentPotential - No JSON pattern found in response');
        throw new Error('Failed to parse LLM response as JSON');
      }
    }
    
    // Add timestamp if not present
    if (!analysis.timestamp) {
      console.log('LOG: assessInvestmentPotential - Adding missing timestamp');
      analysis.timestamp = new Date().toISOString();
    }
    
    // Add token info if not present but available in our data
    if (!analysis.token_info && Object.keys(marketData).length > 0) {
      console.log('LOG: assessInvestmentPotential - Adding missing token_info from market data');
      analysis.token_info = {
        name: marketData.token_name,
        symbol: marketData.token_symbol,
        address: tokenAddress || "Unknown",
        price_usd: marketData.price_usd,
        market_cap: marketData.market_cap,
        fdv: marketData.fdv,
        price_change_24h: marketData.price_change?.h24,
        liquidity_usd: marketData.liquidity_usd,
        base_token: marketData.base_token,
      };
    }
    
    // Make sure token address is included in token_info if not already there
    if (analysis.token_info && !analysis.token_info.address && tokenAddress) {
      console.log('LOG: assessInvestmentPotential - Adding token address to token_info');
      analysis.token_info.address = tokenAddress;
    }
    
    // IMPORTANT: Use our dedicated transaction analysis method instead of LLM's analysis
    if (rawTransactions) {
      console.log('LOG: assessInvestmentPotential - Using dedicated transaction analysis method');
      
      // Use our specialized transaction analysis function
      const detailedTransactionAnalysis = this.analyzeTransactionData(rawTransactions);
      
      // Replace the LLM's transaction analysis with our more data-driven one
      analysis.transaction_analysis = detailedTransactionAnalysis;
      
      // Also include raw transaction data directly
      analysis.raw_transactions = rawTransactions;
    }
    
    // Add social media links if available in the social data
    if (socialData) {
      console.log('LOG: assessInvestmentPotential - Processing social data for links');
      
      // Check if social data has socials array
      if (socialData.socials && Array.isArray(socialData.socials)) {
        analysis.socials = socialData.socials;
        console.log(`LOG: assessInvestmentPotential - Added ${socialData.socials.length} social media links`);
      }
      
      // Check if social data has links.socials
      else if (socialData.links && socialData.links.socials && Array.isArray(socialData.links.socials)) {
        analysis.socials = socialData.links.socials;
        console.log(`LOG: assessInvestmentPotential - Added ${socialData.links.socials.length} social media links from links property`);
      }
      
      // Extract website if available
      if (socialData.website) {
        analysis.website = socialData.website;
        console.log('LOG: assessInvestmentPotential - Added website from social data');
      } else if (socialData.links && socialData.links.website) {
        analysis.website = socialData.links.website;
        console.log('LOG: assessInvestmentPotential - Added website from links property');
      }
      
      // If there's twitter handle info in the social data, make sure it's in the results
      if (socialData.twitter && socialData.twitter.twitter_handle && socialData.twitter.twitter_handle !== "Not found") {
        if (!analysis.socials) analysis.socials = [];
        
        // Check if Twitter is already in the socials list
        const hasTwitter = analysis.socials.some(social => social.type === 'twitter');
        
        if (!hasTwitter) {
          analysis.socials.push({
            type: 'twitter',
            url: `https://x.com/${socialData.twitter.twitter_handle}`
          });
          console.log(`LOG: assessInvestmentPotential - Added Twitter handle from sentiment data: ${socialData.twitter.twitter_handle}`);
        }
      }
    }
    
    // Enhance with market summary for quick reference
    analysis.market_summary = {
      token_name: analysis.token_info?.name || "Unknown",
      token_symbol: analysis.token_info?.symbol || "Unknown",
      token_address: tokenAddress || analysis.token_info?.address || "Unknown",
      price_usd: analysis.token_info?.price_usd || 0,
      market_cap: analysis.token_info?.market_cap || 0,
      fdv: analysis.token_info?.fdv || 0,
      price_change_24h: analysis.token_info?.price_change_24h || 0,
      liquidity_usd: analysis.token_info?.liquidity_usd || marketData?.liquidity_usd || 0,
    };

    // If there's raw pair data in tokenMetrics, include it directly in the result
    if (tokenMetrics && tokenMetrics.enhanced_market_data && tokenMetrics.enhanced_market_data.raw_main_pair) {
      analysis.raw_pair_data = tokenMetrics.enhanced_market_data.raw_main_pair;
    }
    
    // Add trading prompt flag
    analysis.has_trading_prompt = true;
    
    console.log('LOG: assessInvestmentPotential - Assessment complete');
    return analysis;
  } catch (error) {
    console.error('ERROR: assessInvestmentPotential -', error);
    console.log('LOG: assessInvestmentPotential - Returning fallback analysis due to error');
    
    // Get token address from available sources
    let tokenAddress = null;
    if (this.state && this.state.contractAddress) {
      tokenAddress = this.state.contractAddress;
    }
    
    return {
      error: `Error generating recommendation: ${error.message}`,
      token_info: {
        name: "Unknown",
        symbol: "Unknown",
        address: tokenAddress || "Unknown",
        price_usd: 0,
        market_cap: 0,
        fdv: 0,
        price_change_24h: 0
      },
      smart_contract_risk: { rating: 0, comment: "Analysis failed", error: error.message },
      token_performance: { rating: 0, comment: "Analysis failed", error: error.message },
      on_chain_metrics: { rating: 0, comment: "Analysis failed", error: error.message },
      social_sentiment: { rating: 0, comment: "Analysis failed", error: error.message },
      risk_reward_ratio: 0,
      confidence_score: 0,
      final_recommendation: "Analysis failed due to an unexpected error. Please try again.",
      timestamp: new Date().toISOString(),
      has_trading_prompt: true
    };
  }
}

  /**
   * Handle follow-up questions using the conversation history
   * @param {string} question - Follow-up question 
   * @returns {string} Response to the question
   */
  async handleFollowupQuestion(question) {
    console.log(`LOG: handleFollowupQuestion - Processing question: ${question}`);
    
    if (!this.state || this.state.conversationHistory.length === 0) {
      console.log('LOG: handleFollowupQuestion - No state or conversation history available');
      return "Please provide an initial query first.";
    }
    
    try {
      // Create a concise context from conversation history
      console.log('LOG: handleFollowupQuestion - Creating context from conversation history');
      const context = this.state.conversationHistory
        .slice(-2) // Only use last interaction
        .map(entry => `${entry.role}: ${entry.content}`)
        .join("\n");
      
      console.log(`LOG: handleFollowupQuestion - Context created, length: ${context.length}`);
      
      const prompt = `Based on this previous analysis:

      ${context}

      Please answer this follow-up question: ${question}

      Provide a specific answer based on the available information.`;

      console.log('LOG: handleFollowupQuestion - Sending prompt to LLM');
      const response = await this.llm.predict(prompt);
      console.log(`LOG: handleFollowupQuestion - Received response, length: ${response.length}`);
      
      return response;
    } catch (error) {
      console.error('ERROR: handleFollowupQuestion -', error);
      return `Error processing follow-up question: ${error.message}`;
    }
  }

  /**
   * Extract token data from Solana program analysis
   * @param {Object} programData - Solana program analysis data 
   * @returns {Object} Extracted token data
   */
// In the extractTokenDataFromProgramAnalysis method
extractTokenDataFromProgramAnalysis(programData) {
  console.log('LOG: extractTokenDataFromProgramAnalysis - Extracting token data');
  
  if (!programData || programData.error) {
    console.log('LOG: extractTokenDataFromProgramAnalysis - No valid program data available');
    return null;
  }
  
  try {
    // Check if this is a token
    if (programData.token_analysis && programData.token_analysis.is_token) {
      console.log('LOG: extractTokenDataFromProgramAnalysis - Found token data in program analysis');
      
      const metadata = programData.token_analysis.metadata && programData.token_analysis.metadata.success 
        ? programData.token_analysis.metadata 
        : null;
        
      const mintInfo = programData.token_analysis.mint_info && programData.token_analysis.mint_info.success 
        ? programData.token_analysis.mint_info 
        : null;
        
      const holders = programData.token_analysis.holders && programData.token_analysis.holders.success 
        ? programData.token_analysis.holders 
        : null;
      
      // Construct token data from program analysis
      return {
        token_mint: programData.program_data.programId,
        address: programData.program_data.programId, // Added explicit address field
        name: metadata?.name || 'Unknown Token',
        symbol: metadata?.symbol || 'UNKNOWN',
        decimals: mintInfo?.decimals || 0,
        supply: mintInfo?.supply,
        mintAuthority: mintInfo?.mintAuthority,
        canMintMore: mintInfo?.canMintMore,
        holder_count: holders?.holder_count || 0,
        tokenType: programData.program_data.tokenType,
        last_updated: new Date().toISOString()
      };
    }
    
    console.log('LOG: extractTokenDataFromProgramAnalysis - No token data found in program analysis');
    return null;
  } catch (error) {
    console.error('ERROR: extractTokenDataFromProgramAnalysis -', error);
    return {
      error: `Failed to extract token data: ${error.message}`
    };
  }
}

/**
 * Process the initial research query
 * @param {string} query - User's initial query 
 * @returns {Object} Analysis results
 */
async processInitialQuery(query) {
  console.log(`LOG: processInitialQuery - Processing query: ${query}`);
  
  console.log('LOG: processInitialQuery - Creating new agent state');
  this.state = new AgentState();
  this.state.messages.push({ role: 'user', content: query });
  
  try {
    // Step 1: Analyze input type
    console.log('LOG: processInitialQuery - Step 1: Analyzing input type');
    const inputAnalysis = await this.analyzeUserInput(query);
    this.state.inputType = inputAnalysis.type;
    console.log(`LOG: processInitialQuery - Input analysis complete, type: ${inputAnalysis.type}`);
    
    // Set appropriate state based on input type
    console.log('LOG: processInitialQuery - Setting state based on input type');
    if (inputAnalysis.type === 'contract_address') {
      this.state.contractAddress = inputAnalysis.value;
      this.state.currentStep = 'contract_analysis';
      console.log(`LOG: processInitialQuery - Set contract address: ${inputAnalysis.value}`);
    } else {
      this.state.projectName = inputAnalysis.value;
      this.state.currentStep = 'token_search';
      console.log(`LOG: processInitialQuery - Set project name: ${inputAnalysis.value}`);
    }
    
    // Step 2: Analyze contract if address available
    if (this.state.contractAddress) {
      console.log('LOG: processInitialQuery - Step 2: Analyzing contract/program');
      this.state.contractData = await analyzeSolanaProgram(this.state.contractAddress, this.llm);
      console.log('LOG: processInitialQuery - Contract analysis complete');
      
      // Extract token data from contract analysis
      this.state.tokenData = this.extractTokenDataFromProgramAnalysis(this.state.contractData);
      console.log('LOG: processInitialQuery - Token data extracted from program analysis');
    } else {
      console.log('LOG: processInitialQuery - Step 2: No contract address, skipping');
    }

    // NEW STEP: Fetch DexScreener data for market metrics
    if (this.state.contractAddress) {
      console.log('LOG: processInitialQuery - Fetching DexScreener market data');
      try {
        console.log('LOG: processInitialQuery - Fetching DexScreener market data for address:', this.state.contractAddress);
        this.state.marketData = await fetchDexScreenerData(this.state.contractAddress);
        console.log('LOG: processInitialQuery - DexScreener data fetched successfully', this.state.marketData);
        
    // If token data is missing or limited, enhance it with DexScreener data
if (this.state.marketData.success && (!this.state.tokenData || !this.state.tokenData.name)) {
  console.log('LOG: processInitialQuery - Enhancing token data with DexScreener info');
  
  if (!this.state.tokenData) {
    this.state.tokenData = {};
  }
  
  // Add or update token data with DexScreener information
  this.state.tokenData.name = this.state.tokenData.name || this.state.marketData.token_name;
  this.state.tokenData.symbol = this.state.tokenData.symbol || this.state.marketData.token_symbol;
  this.state.tokenData.token_address = this.state.contractAddress || this.state.marketData.token_address;
  this.state.tokenData.market_cap = this.state.marketData.market_cap;
  this.state.tokenData.fdv = this.state.marketData.fdv;
  this.state.tokenData.price_usd = this.state.marketData.price_usd;
  this.state.tokenData.liquidity_usd = this.state.marketData.liquidity_usd;
  this.state.tokenData.volume_24h = this.state.marketData.volume_24h;
  this.state.tokenData.price_change_24h = this.state.marketData.price_change.h24;
  this.state.tokenData.base_token = this.state.marketData.base_token;
  
  // Add all the enhanced data
  this.state.tokenData.enhanced_market_data = {
    liquidity: this.state.marketData.liquidity_usd,
    volume: this.state.marketData.volume,
    price_change: this.state.marketData.price_change,
    transactions: this.state.marketData.transactions,
    base_token: this.state.marketData.base_token,
    buy_sell_ratio_24h: this.state.marketData.buy_sell_ratio_24h,
    pair_info: {
      dex: this.state.marketData.dex,
      pair_address: this.state.marketData.pair_address,
      created_at: this.state.marketData.pair_created_at
    },
    socials: this.state.marketData.links.socials,
    website: this.state.marketData.links.website,
    all_pairs: this.state.marketData.all_pairs,
    raw_main_pair: this.state.marketData.raw_main_pair
  };
}
      } catch (marketError) {
        console.error('ERROR: processInitialQuery - DexScreener analysis failed:', marketError);
        this.state.marketData = { 
          success: false, 
          error: `Market data analysis failed: ${marketError.message}`
        };
      }
    }

    // Step 3: Analyze on-chain metrics if contract address is available
    if (this.state.contractAddress) {
      console.log('LOG: processInitialQuery - Step 3: Analyzing on-chain metrics');
      try {
        this.state.onChainData = await analyzeOnChainMetrics(this.state.contractAddress);
        console.log('LOG: processInitialQuery - On-chain metrics analysis complete');
        
        // If we have market data from DexScreener, add it to onChainData
        if (this.state.marketData && this.state.marketData.success) {
          console.log('LOG: processInitialQuery - Adding market data to on-chain data');
          this.state.onChainData.market_data = {
            price_usd: this.state.marketData.price_usd,
            market_cap: this.state.marketData.market_cap,
            fdv: this.state.marketData.fdv,
            liquidity_usd: this.state.marketData.liquidity_usd,
            volume_24h: this.state.marketData.volume_24h,
            price_change_24h: this.state.marketData.price_change?.h24,
            base_token: this.state.marketData.base_token
          };
        }
      } catch (onChainError) {
        console.error('ERROR: processInitialQuery - On-chain metrics analysis failed:', onChainError);
        this.state.onChainData = { 
          success: false, 
          error: `On-chain metrics analysis failed: ${onChainError.message}`
        };
      }
    } else {
      console.log('LOG: processInitialQuery - Step 3: No contract address, skipping on-chain metrics');
    }

    // Step 4: Analyze social sentiment for the token/project
    if (this.state.tokenData && !this.state.tokenData.error) {
      console.log('LOG: processInitialQuery - Step 4: Analyzing social sentiment using token data');
      // Pass the entire token data object to analyzeSocialSentiment
      this.state.socialData = await analyzeSocialSentiment(this.state.tokenData);
      console.log('LOG: processInitialQuery - Social sentiment analysis complete');
    } else if (this.state.contractAddress) {
      console.log(`LOG: processInitialQuery - Step 4: Analyzing social sentiment using contract address: ${this.state.contractAddress}`);
      this.state.socialData = await analyzeSocialSentiment(this.state.contractAddress);
      console.log('LOG: processInitialQuery - Social sentiment analysis complete');
    } else if (this.state.projectName) {
      console.log(`LOG: processInitialQuery - Step 4: Analyzing social sentiment using project name: ${this.state.projectName}`);
      this.state.socialData = await analyzeSocialSentiment(this.state.projectName);
      console.log('LOG: processInitialQuery - Social sentiment analysis complete');
    } else {
      console.log('LOG: processInitialQuery - Step 4: No token data, contract address, or project name available for social sentiment analysis');
      this.state.socialData = null;
    }
    
    // Step 5: Generate final analysis
    console.log('LOG: processInitialQuery - Step 5: Generating final analysis');
    if ((this.state.contractData && !this.state.contractData.error) ||
        (this.state.tokenData && !this.state.tokenData.error) ||
        (this.state.marketData && this.state.marketData.success)) {
      
      console.log('LOG: processInitialQuery - Data available for analysis, generating recommendation');
      this.state.finalAnalysis = await this.assessInvestmentPotential(
        this.state.contractData || {},
        this.state.tokenData || {},
        this.state.onChainData || {},
        this.state.socialData || {}
      );
      
      // Ensure market data is included in the response
      if (!this.state.finalAnalysis.token_info && this.state.marketData && this.state.marketData.success) {
        this.state.finalAnalysis.token_info = {
          name: this.state.marketData.token_name,
          symbol: this.state.marketData.token_symbol,
          address: this.state.contractAddress || this.state.marketData.token_address,
          price_usd: this.state.marketData.price_usd,
          market_cap: this.state.marketData.market_cap,
          fdv: this.state.marketData.fdv,
          price_change_24h: this.state.marketData.price_change?.h24
        };
      }
      
      // Add socials directly from DexScreener if available and not already in the analysis
      if (!this.state.finalAnalysis.socials && this.state.marketData && this.state.marketData.success && 
          this.state.marketData.links && this.state.marketData.links.socials) {
        console.log('LOG: processInitialQuery - Adding social links from DexScreener to final analysis');
        this.state.finalAnalysis.socials = this.state.marketData.links.socials;
      }
      
      // Add website if available and not already in the analysis
      if (!this.state.finalAnalysis.website && this.state.marketData && this.state.marketData.success && 
          this.state.marketData.links && this.state.marketData.links.website) {
        this.state.finalAnalysis.website = this.state.marketData.links.website;
      }
      
      // NEW: OVERRIDE transaction_analysis with raw data from DexScreener
      if (this.state.marketData && this.state.marketData.success && this.state.marketData.transactions) {
        console.log('LOG: processInitialQuery - Overriding transaction_analysis with raw DexScreener data');
        
        // Calculate trend
        let trend = "Stable";
        const h24 = this.state.marketData.transactions.h24;
        const h1 = this.state.marketData.transactions.h1;
        
        if (h24 && h1 && h24.total > 0) {
          const h24Rate = h24.total / 24; // Avg per hour in 24h period
          const h1Rate = h1.total;        // Last hour
          if (h1Rate > h24Rate * 1.2) {   // 20% higher than average
            trend = "Increasing";
          } else if (h1Rate < h24Rate * 0.8) {  // 20% lower than average
            trend = "Decreasing";
          }
        }
        
        // Completely override transaction_analysis with raw data
        this.state.finalAnalysis.transaction_analysis = {
          // Keep LLM's rating if available
          rating: this.state.finalAnalysis.transaction_analysis?.rating || 7,
          buy_sell_ratio: this.state.marketData.buy_sell_ratio_24h,
          // Keep LLM's comment if sensible, otherwise override
          comment: (this.state.finalAnalysis.transaction_analysis?.comment?.includes("null")) ? 
                  "Raw transaction data from DexScreener" : 
                  this.state.finalAnalysis.transaction_analysis?.comment || "Raw transaction data from DexScreener",
          // Directly use the raw transaction data
          "24h_transactions": this.state.marketData.transactions.h24,
          "6h_transactions": this.state.marketData.transactions.h6,
          "1h_transactions": this.state.marketData.transactions.h1,
          "5m_transactions": this.state.marketData.transactions.m5,
          "transaction_trend": trend
        };
        
        // Also include raw transaction data directly
        this.state.finalAnalysis.raw_transactions = this.state.marketData.transactions;
      }
    } else {
      console.log('LOG: processInitialQuery - Insufficient data for analysis');
      this.state.finalAnalysis = {
        error: "Unable to gather sufficient data for analysis",
        final_recommendation: "Unable to provide recommendation due to insufficient data"
      };
    }
    
    // Add trading prompt
    console.log('LOG: processInitialQuery - Adding trading prompt to final analysis');
    const tradingPrompt = "\n\nWould you like me to execute a token purchase for you? (yes/no): ";
    
    // Save conversation history
    console.log('LOG: processInitialQuery - Saving conversation history');
    this.state.addToHistory('user', query);
    this.state.addToHistory('assistant', JSON.stringify(this.state.finalAnalysis));
    
    console.log('LOG: processInitialQuery - Processing complete, returning final analysis');
    return this.state.finalAnalysis;
    
  } catch (error) {
    console.error('ERROR: processInitialQuery -', error);
    console.log('LOG: processInitialQuery - Returning error response due to failure');
    
    return {
      error: `Analysis failed: ${error.message}`,
      final_recommendation: "Analysis failed due to an unexpected error"
    };
  }
}
  /**
   * Process user's trading decision
   * @param {string} decision - User's decision (yes/no) 
   * @returns {string} Trading result
   */
  async processTradingDecision(decision) {
    console.log(`LOG: processTradingDecision - Processing decision: ${decision}`);
    
    if (!this.state) {
      console.log('LOG: processTradingDecision - No state available');
      return "Please provide an initial query first.";
    }
    
    this.state.tradingDecision = decision;
    console.log(`LOG: processTradingDecision - Saved decision to state: ${decision}`);
    
    if (decision.toLowerCase() === 'yes') {
      console.log('LOG: processTradingDecision - User chose to proceed with trading');
      // In a real implementation, this would connect to trading functionality
      // For now, we'll simulate the process
      this.state.tradingResult = await this.simulateTrading();
    } else {
      console.log('LOG: processTradingDecision - User declined trading');
      this.state.tradingResult = "Trading operation cancelled. No purchase was made.";
    }
    
    console.log('LOG: processTradingDecision - Trading process complete');
    return this.state.tradingResult;
  }

  /**
   * Simulate token trading (placeholder for actual trading integration)
   * @returns {string} Simulated trading result
   */
  async simulateTrading() {
    console.log('LOG: simulateTrading - Simulating token purchase');
    
    try {
      // In a real implementation, this would connect to a trading service
      const tokenSymbol = this.state.tokenData?.symbol || "unknown";
      const tokenName = this.state.tokenData?.name || "unknown";
      
      console.log(`LOG: simulateTrading - Simulating purchase of ${tokenName} (${tokenSymbol})`);
      
      const result = `[SIMULATION] Successfully purchased ${tokenName} (${tokenSymbol}) tokens. This is a simulated transaction. In a production environment, this would execute a real token purchase using a wallet integration.`;
      console.log('LOG: simulateTrading - Simulation complete');
      
      return result;
    } catch (error) {
      console.error('ERROR: simulateTrading -', error);
      return `Trading simulation error: ${error.message}`;
    }
  }

  /**
   * Process follow-up questions
   * @param {string} question - User's follow-up question
   * @returns {string} Response to the question
   */
  async processFollowup(question) {
    console.log(`LOG: processFollowup - Processing follow-up question: ${question}`);
    
    const response = await this.handleFollowupQuestion(question);
    console.log(`LOG: processFollowup - Received response, length: ${response.length}`);
    
    // Update conversation history
    console.log('LOG: processFollowup - Updating conversation history');
    this.state.addToHistory('user', question);
    this.state.addToHistory('assistant', response);
    
    console.log('LOG: processFollowup - Processing complete');
    return response;
  }
}

export default ResearchBot;
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
 * Generate comprehensive investment analysis based on collected data
 * @param {Object} contractAnalysis - Smart contract security analysis
 * @param {Object} tokenMetrics - Token market data
 * @param {Object} onChainData - On-chain metrics analysis
 * @param {Object} socialData - Social sentiment data
 * @returns {Object} Structured investment recommendation
 */
async assessInvestmentPotential(contractAnalysis, tokenMetrics, onChainData, socialData) {
  console.log('LOG: assessInvestmentPotential - Starting investment assessment');
  console.log(`LOG: assessInvestmentPotential - Data available: Contract=${!!contractAnalysis}, Token=${!!tokenMetrics}, OnChain=${!!onChainData}, Social=${!!socialData}`);
  
  try {
    // Extract market data for prompt enrichment
    let marketData = {};
    
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
    
    // Create analysis prompt with enhanced market data and better instructions
    console.log('LOG: assessInvestmentPotential - Creating analysis prompt');
    const prompt = `You are a professional cryptocurrency analyst specializing in Solana tokens. Provide a detailed, data-driven assessment of this token based on the following information.

    TOKEN DATA FOR ANALYSIS:
    
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
       
    4. SOCIAL SENTIMENT EVALUATION:
       - Rate social sentiment from 0-10 (higher is better)
       - Include specific data points about community size or engagement if available
       - Mention specific platforms where token is discussed (Twitter, Telegram, etc.)
       - Note if sentiment data is limited or unavailable
       
    5. OVERALL INVESTMENT ASSESSMENT:
       - Calculate a risk/reward ratio (0-5 scale)
       - Provide a confidence score (0-100%)
       - Deliver a detailed, specific recommendation with timeframe considerations
       - Mention specific catalysts or risk factors unique to this token
       
    6. DO NOT USE GENERIC PHRASES like "The token shows promise" or "Further research is recommended"
       Instead, give concrete insights based on the specific data provided.

    OUTPUT FORMAT:
    Return your analysis as a JSON object with the following structure:
    {
      "token_info": {
        "name": "<token name>",
        "symbol": "<token symbol>",
        "price_usd": <price>,
        "market_cap": <market cap>,
        "fdv": <fully diluted valuation>,
        "price_change_24h": <24h price change percent>
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
      analysis.token_info = marketData;
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
      price_usd: analysis.token_info?.price_usd || 0,
      market_cap: analysis.token_info?.market_cap || 0,
      fdv: analysis.token_info?.fdv || 0,
      price_change_24h: analysis.token_info?.price_change_24h || 0
    };

    // Add trading prompt flag
    analysis.has_trading_prompt = true;
    
    console.log('LOG: assessInvestmentPotential - Assessment complete');
    return analysis;
  } catch (error) {
    console.error('ERROR: assessInvestmentPotential -', error);
    console.log('LOG: assessInvestmentPotential - Returning fallback analysis due to error');
    
    return {
      error: `Error generating recommendation: ${error.message}`,
      token_info: {
        name: "Unknown",
        symbol: "Unknown",
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
        this.state.marketData = await fetchDexScreenerData(this.state.contractAddress);
        console.log('LOG: processInitialQuery - DexScreener data fetched successfully');
        
        // If token data is missing or limited, enhance it with DexScreener data
        if (this.state.marketData.success && (!this.state.tokenData || !this.state.tokenData.name)) {
          console.log('LOG: processInitialQuery - Enhancing token data with DexScreener info');
          
          if (!this.state.tokenData) {
            this.state.tokenData = {};
          }
          
          // Add or update token data with DexScreener information
          this.state.tokenData.name = this.state.tokenData.name || this.state.marketData.token_name;
          this.state.tokenData.symbol = this.state.tokenData.symbol || this.state.marketData.token_symbol;
          this.state.tokenData.market_cap = this.state.marketData.market_cap;
          this.state.tokenData.fdv = this.state.marketData.fdv;
          this.state.tokenData.price_usd = this.state.marketData.price_usd;
          this.state.tokenData.liquidity_usd = this.state.marketData.liquidity_usd;
          this.state.tokenData.volume_24h = this.state.marketData.volume_24h;
          this.state.tokenData.price_change_24h = this.state.marketData.price_change?.h24;
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
            price_change_24h: this.state.marketData.price_change?.h24
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
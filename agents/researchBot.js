// server/agents/researchBot.js
import { ChatOpenAI } from '@langchain/openai';
import axios from 'axios';
import { parse } from 'url';

// Import services
import { 
  analyzeSolanaProgram, 
} from '../../services/solanaProgram.js';

// Import social sentiment analysis service 
import { analyzeSocialSentiment } from '../../services/socialSentiment.js';

// Import on-chain metrics analysis service
import { analyzeOnChainMetrics } from '../../services/onChainMetrics.js';

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
      // Create analysis prompt
      console.log('LOG: assessInvestmentPotential - Creating analysis prompt');
      const prompt = `Analyze the following Solana cryptocurrency investment data and provide a detailed assessment.
      
      Solana Program Security Analysis:
      ${JSON.stringify(contractAnalysis || {}, null, 2)}
      
      Token Metrics:
      ${JSON.stringify(tokenMetrics || {}, null, 2)}
      
      On-Chain Metrics Analysis:
      ${JSON.stringify(onChainData || {}, null, 2)}
      
      Social Sentiment Analysis:
      ${JSON.stringify(socialData || {}, null, 2)}

      Instructions:
      1. Analyze each aspect thoroughly
      2. Provide ratings on a 0-10 scale (0 for missing/invalid data)
      3. Include brief but specific comments
      4. Note any data issues or anomalies as errors
      5. Calculate risk/reward ratio (0-5) and confidence score (0-100%)
      6. Provide a final investment recommendation
      7. If data is missing or invalid, the error should be "Not enough data"

      Return your analysis in this JSON format:
      {
        "smart_contract_risk": { "rating": <0-10>, "comment": "<comment>", "error": "<error or null>" },
        "token_performance": { "rating": <0-10>, "comment": "<comment>", "error": "<error or null>" },
        "on_chain_metrics": { "rating": <0-10>, "comment": "<comment>", "error": "<error or null>" },
        "social_sentiment": { "rating": <0-10>, "comment": "<comment>", "error": "<error or null>" },
        "risk_reward_ratio": <0-5>,
        "confidence_score": <0-100>,
        "final_recommendation": "<recommendation text>",
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
      
      console.log('LOG: assessInvestmentPotential - Assessment complete');
      return analysis;
    } catch (error) {
      console.error('ERROR: assessInvestmentPotential -', error);
      console.log('LOG: assessInvestmentPotential - Returning fallback analysis due to error');
      
      return {
        error: `Error generating recommendation: ${error.message}`,
        smart_contract_risk: { rating: 0, comment: "", error: "Analysis failed" },
        token_performance: { rating: 0, comment: "", error: "Analysis failed" },
        on_chain_metrics: { rating: 0, comment: "", error: "Analysis failed" },
        social_sentiment: { rating: 0, comment: "", error: "Analysis failed" },
        risk_reward_ratio: 0,
        confidence_score: 0,
        final_recommendation: "Analysis failed due to error",
        timestamp: new Date().toISOString()
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

      // Step 3: Analyze on-chain metrics if contract address is available
      if (this.state.contractAddress) {
        console.log('LOG: processInitialQuery - Step 3: Analyzing on-chain metrics');
        try {
          this.state.onChainData = await analyzeOnChainMetrics(this.state.contractAddress);
          console.log('LOG: processInitialQuery - On-chain metrics analysis complete');
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
          (this.state.tokenData && !this.state.tokenData.error)) {
        
        console.log('LOG: processInitialQuery - Data available for analysis, generating recommendation');
        this.state.finalAnalysis = await this.assessInvestmentPotential(
          this.state.contractData || {},
          this.state.tokenData || {},
          this.state.onChainData || {},
          this.state.socialData || {}
        );
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
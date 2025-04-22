// server/services/solanaProgram.js
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Standard SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
// Token-2022 Program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
// Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelayMs - Initial delay in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds
 * @param {number} options.backoffFactor - Factor to increase delay by
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(
  fn, 
  options = {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2
  }
) {
  let lastError;
  let currentDelay = options.initialDelayMs;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${options.maxRetries} after ${currentDelay}ms delay`);
        await delay(currentDelay);
      }
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = error.message?.includes('rate limit') || 
                         error.response?.status === 429 ||
                         error.response?.data?.error?.message?.includes('rate limit');
      
      if (!isRateLimit && attempt >= options.maxRetries) {
        throw error;
      }

      // Increase delay for next retry with exponential backoff
      currentDelay = Math.min(
        currentDelay * options.backoffFactor,
        options.maxDelayMs
      );
      
      // Add some randomness to prevent thundering herd problem
      currentDelay += Math.floor(Math.random() * 1000);
      
      console.log(`Request error (${error.message}), will retry in ${currentDelay}ms`);
    }
  }
  
  throw lastError || new Error('Maximum retries reached');
}

/**
 * Enhanced delay function with optional logging
 * @param {number} ms - Milliseconds to delay
 * @param {boolean} log - Whether to log the delay
 * @returns {Promise} Promise that resolves after delay
 */
const delay = (ms, log = false) => {
  if (log) {
    console.log(`Waiting for ${ms}ms...`);
  }
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Fetches program data from Solana blockchain
 * @param {string} programAddress - Solana program address
 * @returns {Object} Program data and activity info
 */
async function fetchProgramData(programAddress) {
  console.log('STEP: fetchProgramData - Starting for:', programAddress);
  
  try {
    // Validate address format
    console.log('STEP: fetchProgramData - Validating address format');
    const programId = new PublicKey(programAddress);
    console.log('STEP: fetchProgramData - Address format valid');
    
    // Fetch program account info with retry
    console.log('STEP: fetchProgramData - Fetching account info');
    const accountInfo = await withRetry(async () => {
      const info = await connection.getAccountInfo(programId);
      if (!info) {
        throw new Error('Program not found on Solana blockchain');
      }
      return info;
    });
    
    console.log('STEP: fetchProgramData - Account info received, owner:', accountInfo.owner.toString());
    
    // Fetch recent signatures (transactions) with retry
    console.log('STEP: fetchProgramData - Fetching signatures');
    const signatures = await withRetry(async () => {
      return await connection.getSignaturesForAddress(programId, { limit: 10 });
    });
    
    console.log('STEP: fetchProgramData - Signatures received, count:', signatures.length);
    
    // Get program balance with retry
    console.log('STEP: fetchProgramData - Fetching balance');
    const balance = await withRetry(async () => {
      return await connection.getBalance(programId);
    });
    
    console.log('STEP: fetchProgramData - Balance received:', balance);
    
    // Determine token program type
    let tokenType = "Unknown";
    console.log('STEP: fetchProgramData - Checking token type');
    if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      tokenType = "Standard SPL Token";
      console.log('STEP: fetchProgramData - Identified as Standard SPL Token');
    } else if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      tokenType = "Token-2022 (Enhanced Features)";
      console.log('STEP: fetchProgramData - Identified as Token-2022');
    } else {
      console.log('STEP: fetchProgramData - Not a recognized token program, owner:', accountInfo.owner.toString());
    }
    
    const result = {
      programId: programId.toString(),
      executable: accountInfo.executable,
      owner: accountInfo.owner.toString(),
      lamports: accountInfo.lamports,
      dataSize: accountInfo.data.length,
      balance: balance / 10**9, // Convert lamports to SOL
      recent_transactions: signatures.length,
      last_transaction: signatures.length > 0 ? signatures[0].blockTime : null,
      tokenType: tokenType
    };
    
    console.log('STEP: fetchProgramData - Complete, returning data');
    return result;
  } catch (error) {
    console.error('ERROR in fetchProgramData:', error.message);
    throw new Error(`Failed to fetch Solana program: ${error.message}`);
  }
}

/**
 * Analyze mint authority and token supply
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Token mint analysis
 */
async function analyzeMintAuthority(tokenAddress) {
  console.log('STEP: analyzeMintAuthority - Starting for:', tokenAddress);
  
  try {
    console.log('STEP: analyzeMintAuthority - Creating PublicKey');
    const mintPubkey = new PublicKey(tokenAddress);
    
    console.log('STEP: analyzeMintAuthority - Fetching account info');
    const mintInfo = await withRetry(async () => {
      const info = await connection.getAccountInfo(mintPubkey);
      if (!info) {
        throw new Error('Token mint account not found');
      }
      return info;
    });
    
    console.log('STEP: analyzeMintAuthority - Account info received, data length:', mintInfo.data.length);
    
    // For SPL tokens, authority is at bytes 0-32
    let mintAuthority = null;
    let supply = null;
    let decimals = null;
    
    try {
      console.log('STEP: analyzeMintAuthority - Parsing mint data');
      
      // Extract decimals (1 byte at offset 44)
      decimals = mintInfo.data[44];
      console.log('STEP: analyzeMintAuthority - Decimals:', decimals);
      
      // Extract authority (pubkey at offset 0)
      const authorityBytes = mintInfo.data.slice(0, 32);
      // Check if all bytes are 0 (no authority)
      const hasAuthority = !authorityBytes.every(b => b === 0);
      console.log('STEP: analyzeMintAuthority - Has mint authority:', hasAuthority);
      
      if (hasAuthority) {
        mintAuthority = new PublicKey(authorityBytes).toString();
        console.log('STEP: analyzeMintAuthority - Mint authority:', mintAuthority);
      }
      
      // Extract supply (u64 at offset 36)
      const supplyBytes = mintInfo.data.slice(36, 44);
      // Convert bytes to BigInt
      supply = BigInt(0);
      for (let i = 0; i < 8; i++) {
        supply += BigInt(supplyBytes[i]) << BigInt(8 * i);
      }
      console.log('STEP: analyzeMintAuthority - Raw supply:', supply.toString());
      
      // Convert to decimal string with proper decimal places
      if (decimals > 0) {
        const divisor = BigInt(10) ** BigInt(decimals);
        const wholePart = supply / divisor;
        const fractionalPart = supply % divisor;
        supply = `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`;
        console.log('STEP: analyzeMintAuthority - Formatted supply:', supply);
      } else {
        supply = supply.toString();
        console.log('STEP: analyzeMintAuthority - Supply (no decimals):', supply);
      }
    } catch (err) {
      console.warn('WARNING in analyzeMintAuthority - Error parsing mint data:', err.message);
    }
    
    const result = {
      success: true,
      mintAuthority: mintAuthority,
      canMintMore: mintAuthority !== null,
      supply: supply,
      decimals: decimals,
      frozen: false // Need more data to determine if frozen
    };
    
    console.log('STEP: analyzeMintAuthority - Complete, returning data');
    return result;
  } catch (error) {
    console.error('ERROR in analyzeMintAuthority:', error.message);
    return {
      success: false,
      error: `Failed to analyze mint authority: ${error.message}`
    };
  }
}

/**
 * Check for token metadata
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Token metadata if available
 */
async function fetchTokenMetadata(tokenAddress) {
  console.log('STEP: fetchTokenMetadata - Starting for:', tokenAddress);
  
  try {
    console.log('STEP: fetchTokenMetadata - Creating PublicKey');
    const mintPubkey = new PublicKey(tokenAddress);
    
    // Derive metadata PDA address
    console.log('STEP: fetchTokenMetadata - Deriving metadata address');
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      METADATA_PROGRAM_ID
    );
    console.log('STEP: fetchTokenMetadata - Metadata address:', metadataAddress.toString());
    
    // Fetch metadata account with retry
    console.log('STEP: fetchTokenMetadata - Fetching metadata account');
    const metadataAccountInfo = await withRetry(async () => {
      return await connection.getAccountInfo(metadataAddress);
    });
    
    if (!metadataAccountInfo) {
      console.log('STEP: fetchTokenMetadata - No metadata found');
      return {
        success: false,
        error: "No metadata found for this token"
      };
    }
    
    console.log('STEP: fetchTokenMetadata - Metadata found, data length:', metadataAccountInfo.data.length);
    
    // Attempt to parse metadata (simplified)
    let name = null;
    let symbol = null;
    let uri = null;
    
    try {
      console.log('STEP: fetchTokenMetadata - Parsing metadata');
      // Metadata parsing logic (simplified)
      // This is a simplified approach - a full parser would be more complex
      const data = metadataAccountInfo.data;
      
      // Skip key and update auth (1 + 32 bytes)
      let offset = 33;
      console.log('STEP: fetchTokenMetadata - Parsing from offset:', offset);
      
      // Skip mint (32 bytes)
      offset += 32;
      
      // Name length is a u32 (4 bytes)
      const nameLength = data[offset] + (data[offset + 1] << 8) + 
                         (data[offset + 2] << 16) + (data[offset + 3] << 24);
      offset += 4;
      console.log('STEP: fetchTokenMetadata - Name length:', nameLength);
      
      // Name is utf8 string of nameLength
      name = Buffer.from(data.slice(offset, offset + nameLength)).toString('utf8');
      offset += nameLength;
      console.log('STEP: fetchTokenMetadata - Name:', name);
      
      // Symbol length is a u32 (4 bytes)
      const symbolLength = data[offset] + (data[offset + 1] << 8) + 
                          (data[offset + 2] << 16) + (data[offset + 3] << 24);
      offset += 4;
      console.log('STEP: fetchTokenMetadata - Symbol length:', symbolLength);
      
      // Symbol is utf8 string of symbolLength
      symbol = Buffer.from(data.slice(offset, offset + symbolLength)).toString('utf8');
      offset += symbolLength;
      console.log('STEP: fetchTokenMetadata - Symbol:', symbol);
      
      // URI length is a u32 (4 bytes)
      const uriLength = data[offset] + (data[offset + 1] << 8) + 
                       (data[offset + 2] << 16) + (data[offset + 3] << 24);
      offset += 4;
      console.log('STEP: fetchTokenMetadata - URI length:', uriLength);
      
      // URI is utf8 string of uriLength
      uri = Buffer.from(data.slice(offset, offset + uriLength)).toString('utf8');
      console.log('STEP: fetchTokenMetadata - URI:', uri.substring(0, 50) + (uri.length > 50 ? '...' : ''));
    } catch (parseError) {
      console.warn('WARNING in fetchTokenMetadata - Error parsing metadata:', parseError.message);
    }
    
    const result = {
      success: true,
      name: name,
      symbol: symbol,
      uri: uri,
      metadataAddress: metadataAddress.toString()
    };
    
    console.log('STEP: fetchTokenMetadata - Complete, returning data');
    return result;
  } catch (error) {
    console.error('ERROR in fetchTokenMetadata:', error.message);
    return {
      success: false,
      error: `Failed to fetch token metadata: ${error.message}`
    };
  }
}

/**
 * Attempts to detect token-2022 extensions
 * @param {string} tokenAddress - Token mint address
 * @returns {Object} Extension analysis
 */
async function analyzeTokenExtensions(tokenAddress) {
  console.log('STEP: analyzeTokenExtensions - Starting for:', tokenAddress);
  
  try {
    console.log('STEP: analyzeTokenExtensions - Creating PublicKey');
    const mintPubkey = new PublicKey(tokenAddress);
    
    console.log('STEP: analyzeTokenExtensions - Fetching account info');
    const mintInfo = await withRetry(async () => {
      const info = await connection.getAccountInfo(mintPubkey);
      if (!info) {
        throw new Error('Token mint account not found');
      }
      return info;
    });
    
    console.log('STEP: analyzeTokenExtensions - Account info received, owner:', mintInfo.owner.toString());
    
    // Check if this is likely a Token-2022 mint based on owner
    const isToken2022 = mintInfo.owner.toString() === TOKEN_2022_PROGRAM_ID.toString();
    console.log('STEP: analyzeTokenExtensions - Is Token-2022:', isToken2022);
    
    if (!isToken2022) {
      console.log('STEP: analyzeTokenExtensions - Not Token-2022, no extensions expected');
      return {
        success: true,
        has_extensions: false,
        extensions: []
      };
    }
    
    // For Token-2022, extensions would be detected from the TLV data
    // This is a simplified check - a full implementation would need to decode TLV
    const hasExtensions = mintInfo.data.length > 82;
    console.log('STEP: analyzeTokenExtensions - Data length:', mintInfo.data.length, 'Has extensions:', hasExtensions);
    
    // Extension details would require more complex parsing
    // For now we just report if extensions exist
    const result = {
      success: true,
      has_extensions: hasExtensions,
      extensions: hasExtensions ? ["Detected but not parsed"] : []
    };
    
    console.log('STEP: analyzeTokenExtensions - Complete, returning data');
    return result;
  } catch (error) {
    console.error('ERROR in analyzeTokenExtensions:', error.message);
    return {
      success: false,
      error: `Failed to analyze token extensions: ${error.message}`
    };
  }
}

/**
 * Analyze token performance metrics based on transaction history and volume
 * @param {string} tokenAddress - Token mint address
 * @param {number} delayMs - Delay in milliseconds to avoid rate limiting (default: 1500ms)
 * @returns {Object} Token performance metrics
 */
async function analyzeTokenPerformance(tokenAddress, delayMs = 1500) {
  console.log('STEP: analyzeTokenPerformance - Starting for:', tokenAddress);
  
  try {
    console.log('STEP: analyzeTokenPerformance - Creating PublicKey');
    const mintPubkey = new PublicKey(tokenAddress);
    
    // Get more transaction history to analyze performance with retry
    console.log('STEP: analyzeTokenPerformance - Fetching transaction signatures');
    
    // Get last 100 signatures for better analysis with retry
    const signatures = await withRetry(async () => {
      return await connection.getSignaturesForAddress(
        mintPubkey, 
        { limit: 100 }
      );
    }, {
      maxRetries: 4,
      initialDelayMs: delayMs,
      maxDelayMs: 30000,
      backoffFactor: 2
    });
    
    console.log(`STEP: analyzeTokenPerformance - Retrieved ${signatures.length} transaction signatures`);
    
    // Get current timestamp and calculate timeframes
    const now = new Date().getTime() / 1000; // Current time in seconds
    const oneDayAgo = now - (24 * 60 * 60);
    const oneWeekAgo = now - (7 * 24 * 60 * 60);
    const oneMonthAgo = now - (30 * 24 * 60 * 60);
    
    // Count transactions in different time frames
    const dayTxCount = signatures.filter(sig => sig.blockTime && sig.blockTime > oneDayAgo).length;
    const weekTxCount = signatures.filter(sig => sig.blockTime && sig.blockTime > oneWeekAgo).length;
    const monthTxCount = signatures.filter(sig => sig.blockTime && sig.blockTime > oneMonthAgo).length;
    
    console.log(`STEP: analyzeTokenPerformance - Transaction counts: 24h: ${dayTxCount}, 7d: ${weekTxCount}, 30d: ${monthTxCount}`);
    
    // Try to get price data using the Jupiter API
    let priceData = null;
    
    try {
      console.log('STEP: analyzeTokenPerformance - Attempting to get price data from Jupiter');
      
      // Jupiter API for token price
      const jupiterUrl = `https://lite-api.jup.ag/price/v2?ids=${tokenAddress}`;
      
      const response = await withRetry(async () => {
        console.log('STEP: analyzeTokenPerformance - Making request to Jupiter API');
        const res = await axios.get(jupiterUrl, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'SolanaTokenAnalyzer/1.0'
          },
          timeout: 15000
        });
        
        if (!res.data || !res.data.data) {
          throw new Error('Invalid price data response from Jupiter');
        }
        
        return res;
      }, {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        backoffFactor: 2
      });
      
      // Process the Jupiter response
      const tokenPriceInfo = response.data.data[tokenAddress];
      
      if (tokenPriceInfo) {
        priceData = {
          price_usd: tokenPriceInfo.price,
          source: 'jupiter',
          type: tokenPriceInfo.type,
          timestamp: new Date().toISOString()
        };
        console.log(`STEP: analyzeTokenPerformance - Retrieved price data: $${priceData.price_usd}`);
      } else {
        console.log('STEP: analyzeTokenPerformance - No price data available from Jupiter');
      }
    } catch (priceError) {
      console.error('ERROR in analyzeTokenPerformance (price fetch):', priceError.message);
      console.log('STEP: analyzeTokenPerformance - Could not retrieve price data, continuing without it');
    }
    
    // Calculate momentum score (higher is better)
    const activityRatio = weekTxCount > 0 ? (dayTxCount / weekTxCount) * 7 : 0; // Normalized to 0-7 range
    
    // Calculate various performance metrics
    const performanceScore = Math.min(
      Math.round(
        (dayTxCount * 0.4) + 
        (weekTxCount * 0.3) + 
        (monthTxCount * 0.2) + 
        (activityRatio * 10)
      ), 
      100
    ); // Score from 0-100
    
    // Get transaction dates to calculate average time between transactions
    const txDates = signatures
      .filter(sig => sig.blockTime)
      .map(sig => sig.blockTime)
      .sort((a, b) => b - a); // Sort newest first
    
    let avgTimeBetweenTxs = null;
    
    if (txDates.length > 1) {
      let totalTimeDiff = 0;
      for (let i = 0; i < txDates.length - 1; i++) {
        totalTimeDiff += (txDates[i] - txDates[i + 1]);
      }
      avgTimeBetweenTxs = Math.round(totalTimeDiff / (txDates.length - 1));
      console.log(`STEP: analyzeTokenPerformance - Average time between transactions: ${avgTimeBetweenTxs} seconds`);
    }
    
    // Build performance result object
    const result = {
      success: true,
      transaction_counts: {
        last_24h: dayTxCount,
        last_7d: weekTxCount,
        last_30d: monthTxCount,
        total_analyzed: signatures.length
      },
      performance_metrics: {
        activity_score: performanceScore,
        activity_ratio: parseFloat(activityRatio.toFixed(2)),
        avg_time_between_txs: avgTimeBetweenTxs ? `${avgTimeBetweenTxs} seconds` : null,
        trend: activityRatio > 1 ? "Increasing" : (activityRatio < 0.5 ? "Decreasing" : "Stable")
      },
      price_data: priceData,
      last_transaction: signatures.length > 0 ? {
        signature: signatures[0].signature,
        time: signatures[0].blockTime ? new Date(signatures[0].blockTime * 1000).toISOString() : null
      } : null
    };
    
    console.log('STEP: analyzeTokenPerformance - Analysis complete');
    return result;
  } catch (error) {
    console.error('ERROR in analyzeTokenPerformance:', error.message);
    return {
      success: false,
      error: `Failed to analyze token performance: ${error.message}`
    };
  }
}

/**
 * Analyzes security aspects of a Solana token
 * @param {Object} tokenData - Collected token data
 * @param {Object} llm - Language model instance for analysis
 * @returns {string} Security analysis
 */
async function analyzeTokenSecurity(tokenData, llm) {
  console.log('STEP: analyzeTokenSecurity - Starting analysis');
  
  try {
    console.log('STEP: analyzeTokenSecurity - Preparing prompt');
    const prompt = `Analyze this Solana token for security risks:
    
    Token Data:
    ${JSON.stringify(tokenData, null, 2)}
    
    Please focus on:
    1. Mint authority control - Can new tokens be minted? Is it centralized?
    2. Token program type - Is it using standard SPL Token or Token-2022?
    3. Supply considerations - What's the total supply? Is it reasonable?
    4. Token metadata - Does the token have proper metadata?
    5. Holder distribution - How concentrated is token ownership?
    6. Any extensions or special features that might present risks
    
    Provide a clear summary of security considerations and potential risks:`;
    
    console.log('STEP: analyzeTokenSecurity - Sending to LLM for analysis');
    const analysis = await llm.predict(prompt);
    console.log('STEP: analyzeTokenSecurity - LLM analysis received, length:', analysis.length);
    
    return analysis;
  } catch (error) {
    console.error('ERROR in analyzeTokenSecurity:', error.message);
    return `Error analyzing token security: ${error.message}`;
  }
}

/**
 * Comprehensive analysis of a Solana program/token
 * @param {string} programAddress - Solana program/token address
 * @param {Object} llm - Language model instance
 * @param {Object} options - Analysis options
 * @param {number} options.delayMs - Delay in milliseconds between API requests (default: 1500)
 * @returns {Object} Complete program/token analysis
 */
async function analyzeSolanaProgram(programAddress, llm, options = { delayMs: 1500 }) {
  console.log('STEP: analyzeSolanaProgram - Starting analysis for:', programAddress);
  
  try {
    // Get on-chain program data with retry
    console.log('STEP: analyzeSolanaProgram - Fetching program data');
    const programData = await fetchProgramData(programAddress);
    console.log('STEP: analyzeSolanaProgram - Program data received');
    
    // Check if this is a token mint
    let isTokenMint = false;
    
    // A token mint would typically be owned by the Token or Token-2022 program
    if (programData.owner === TOKEN_PROGRAM_ID.toString() || 
        programData.owner === TOKEN_2022_PROGRAM_ID.toString()) {
      isTokenMint = true;
      console.log('STEP: analyzeSolanaProgram - Address identified as token mint');
    } else {
      console.log('STEP: analyzeSolanaProgram - Address is not a token mint, owner:', programData.owner);
    }
    
    let tokenAnalysis = null;
    let securityAnalysis = 'Unable to perform detailed analysis';
    
    if (isTokenMint) {
      console.log('STEP: analyzeSolanaProgram - Performing token mint analysis');
      
      // This is a token mint - get token-specific data
      console.log('STEP: analyzeSolanaProgram - Analyzing mint authority');
      const mintAuthorityInfo = await analyzeMintAuthority(programAddress);
      
      console.log('STEP: analyzeSolanaProgram - Fetching token metadata');
      const metadataInfo = await fetchTokenMetadata(programAddress);
      
      // Add small delay between API calls if needed
      await delay(Math.floor(options.delayMs / 3));
      
      console.log('STEP: analyzeSolanaProgram - Analyzing token extensions');
      const extensionInfo = await analyzeTokenExtensions(programAddress);
      
      // Add delay before performance analysis
      await delay(Math.floor(options.delayMs / 2));
      
      // Fetch token performance data
      console.log('STEP: analyzeSolanaProgram - Analyzing token performance');
      const performanceInfo = await analyzeTokenPerformance(programAddress, options.delayMs);
      
      // Import the token holders module to get holder data
      // This now uses the specialized holder analysis module instead
      console.log('STEP: analyzeSolanaProgram - Fetching token holder data from tokenHolders module');
      let holderInfo;
      
      try {
        // Dynamic import to avoid circular dependencies
        const { analyzeTokenHolderDistribution } = await import('./tokenHolders.js');
        
        // Use the quick analysis mode (not full pagination) for basic holder data
        holderInfo = await analyzeTokenHolderDistribution(programAddress, {
          fetchFullList: false  // Use quick mode for basic analysis
        });
        
        console.log('STEP: analyzeSolanaProgram - Holder data retrieved from tokenHolders module');
      } catch (holderError) {
        console.error('ERROR fetching token holders:', holderError.message);
        holderInfo = {
          success: false,
          error: `Failed to fetch token holders: ${holderError.message}`
        };
      }
      
      console.log('STEP: analyzeSolanaProgram - All token data collected:');
      console.log('  - Mint authority info:', mintAuthorityInfo.success ? 'Success' : 'Failed');
      console.log('  - Metadata info:', metadataInfo.success ? 'Success' : 'Failed');
      console.log('  - Holder info:', holderInfo.success ? 'Success' : 'Failed');
      console.log('  - Extension info:', extensionInfo.success ? 'Success' : 'Failed');
      console.log('  - Performance info:', performanceInfo.success ? 'Success' : 'Failed');
      
      tokenAnalysis = {
        is_token: true,
        mint_info: mintAuthorityInfo,
        metadata: metadataInfo,
        holders: holderInfo,
        extensions: extensionInfo,
        performance: performanceInfo
      };
      
      // Perform token security analysis
      console.log('STEP: analyzeSolanaProgram - Performing security analysis');
      securityAnalysis = await analyzeTokenSecurity({
        program_data: programData,
        token_analysis: tokenAnalysis
      }, llm);
      console.log('STEP: analyzeSolanaProgram - Security analysis complete');
    } else {
      // This is a program, not a token mint
      console.log('STEP: analyzeSolanaProgram - Skipping token analysis for non-token address');
      tokenAnalysis = { is_token: false };
      securityAnalysis = 'This appears to be a program, not a token mint. Source code is not available for security analysis, which is common for Solana programs.';
    }
    
    const result = {
      program_data: programData,
      token_analysis: tokenAnalysis,
      security_analysis: securityAnalysis
    };
    
    console.log('STEP: analyzeSolanaProgram - Analysis complete, returning results');
    return result;
  } catch (error) {
    console.error('ERROR in analyzeSolanaProgram:', error.message, error.stack);
    return { error: `Failed to analyze Solana program: ${error.message}` };
  }
}

export {
  fetchProgramData,
  analyzeMintAuthority,
  fetchTokenMetadata,
  analyzeTokenExtensions,
  analyzeTokenSecurity,
  analyzeTokenPerformance,
  analyzeSolanaProgram,
  withRetry,
  delay
};
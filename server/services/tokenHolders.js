// server/services/tokenHolders.js
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Set DEBUG mode for development
const DEBUG = process.env.NODE_ENV !== 'production';

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
 * Improved retry function with adaptive backoff specifically for rate limits
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(
  fn, 
  options = {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffFactor: 2.5,
    jitterFactor: 0.2
  }
) {
  let lastError;
  let currentDelay = options.initialDelayMs;
  let consecutiveRateLimits = 0;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Add jitter to prevent thundering herd problem
        const jitter = options.jitterFactor * currentDelay * (Math.random() - 0.5);
        const delayWithJitter = Math.max(1000, Math.floor(currentDelay + jitter));
        
        console.log(`Retry attempt ${attempt}/${options.maxRetries} after ${delayWithJitter}ms delay`);
        await delay(delayWithJitter, true);
      }
      
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      const isRateLimit = 
        error.message?.includes('429') || 
        error.message?.includes('rate limit') || 
        error.response?.status === 429 ||
        error.response?.data?.error?.code === 429 ||
        error.response?.data?.error?.message?.includes('rate limit') ||
        error.response?.data?.error?.message?.includes('Too many requests');
      
      if (isRateLimit) {
        consecutiveRateLimits++;
        
        // More aggressive backoff for rate limits
        currentDelay = Math.min(
          currentDelay * (options.backoffFactor + consecutiveRateLimits * 0.5),
          options.maxDelayMs
        );
        
        console.log(`Rate limit detected (${consecutiveRateLimits} consecutive), will retry in ${currentDelay}ms`);
      } else {
        // For non-rate-limit errors, use standard backoff
        currentDelay = Math.min(
          currentDelay * options.backoffFactor,
          options.maxDelayMs
        );
        
        console.log(`Request error (${error.message}), will retry in ${currentDelay}ms`);
        
        // If not a rate limit and we've exhausted retries, throw
        if (attempt >= options.maxRetries) {
          throw error;
        }
      }
      
      // If we've reached max retries and still getting rate limited, throw
      if (isRateLimit && attempt >= options.maxRetries) {
        throw new Error(`Rate limit persists after ${options.maxRetries} retries. Consider reducing request frequency.`);
      }
    }
  }
  
  throw lastError || new Error('Maximum retries reached');
}

/**
 * Fetch all token holders with pagination support
 * @param {string} tokenAddress - Token mint address
 * @param {Object} options - Options for fetching
 * @param {boolean} options.saveToFile - Whether to save results to file
 * @param {string} options.outputDir - Directory to save output
 * @param {number} options.pageSize - Number of results per page
 * @param {number} options.maxPages - Maximum number of pages to fetch (0 for all)
 * @param {number} options.delayBetweenPages - Delay between page requests in ms
 * @param {boolean} options.showZeroBalance - Whether to include accounts with zero balance
 * @returns {Object} Token holders data
 */
async function fetchAllTokenHolders(tokenAddress, options = {
  saveToFile: false,
  outputDir: './data',
  pageSize: DEBUG ? 10 : 50,       // Smaller page size in development
  maxPages: 0,
  delayBetweenPages: DEBUG ? 5000 : 2000,  // Longer delay in development
  showZeroBalance: false
}) {
  console.log(`STEP: fetchAllTokenHolders - Starting for: ${tokenAddress}`);
  
  if (!process.env.HELIUS_API_KEY) {
    console.error('ERROR: HELIUS_API_KEY is required for fetchAllTokenHolders');
    return {
      success: false,
      error: 'HELIUS_API_KEY is required for this operation'
    };
  }

  // Check for mock data during development
  if (DEBUG && process.env.USE_MOCKS === 'true') {
    const mockPath = `./data/mocks/${tokenAddress}_holders.json`;
    if (fs.existsSync(mockPath)) {
      console.log(`STEP: fetchAllTokenHolders - Using mock data from ${mockPath}`);
      return JSON.parse(fs.readFileSync(mockPath, 'utf8'));
    }
  }

  let allHolders = new Set();
  let allAccounts = [];
  let totalTokenSupply = 0;

  try {
    console.log('STEP: fetchAllTokenHolders - Validating token address');
    // Validate token address
    const mintPubkey = new PublicKey(tokenAddress);
    
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    let page = 1;
    let hasMorePages = true;
    
    console.log(`STEP: fetchAllTokenHolders - Starting pagination with page size: ${options.pageSize}`);
    
    // For basic analysis, try to get at least some data with a single request
    if (options.maxPages === 1 && options.pageSize <= 10) {
      console.log('STEP: fetchAllTokenHolders - Basic mode detected, making a single request');
      
      try {
        // Add a longer delay in development mode
        if (DEBUG) {
          console.log('Adding development delay of 3s before request');
          await delay(3000);
        }
        
        const response = await withRetry(async () => {
          const request = {
            jsonrpc: '2.0',
            id: 'helius-token-holders-basic',
            method: 'getTokenAccounts',
            params: {
              mint: tokenAddress,
              page: 1,
              limit: options.pageSize,
              options: {
                showZeroBalance: options.showZeroBalance
              }
            }
          };
          
          if (DEBUG) {
            console.log('Request payload:', JSON.stringify(request));
          }
          
          const res = await axios.post(
            heliusUrl,
            request,
            {
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SolanaTokenAnalyzer/1.0'
              },
              timeout: 30000  // Increased timeout
            }
          );
          
          if (DEBUG) {
            console.log('Response status:', res.status);
            console.log('Response structure:', JSON.stringify(res.data).substring(0, 200) + '...');
          }
          
          if (!res.data) {
            throw new Error('Empty response from Helius API');
          }
          
          return res;
        }, {
          maxRetries: 4,
          initialDelayMs: 3000,
          maxDelayMs: 60000,
          backoffFactor: 2.5
        });
        
        if (!response.data || !response.data.result) {
          console.error('Invalid response structure:', JSON.stringify(response.data).substring(0, 500));
          throw new Error('Invalid response structure from Helius API');
        }
        
        // *** FIX: Extract accounts from token_accounts array ***
        const result = response.data.result;
        const accounts = result.token_accounts;
        
        // Check if accounts is an array
        if (!Array.isArray(accounts)) {
          console.error('token_accounts is not an array:', typeof accounts, accounts);
          throw new Error('Expected array of token_accounts but got: ' + typeof accounts);
        }
        
        if (accounts.length > 0) {
          console.log(`STEP: fetchAllTokenHolders - Received ${accounts.length} accounts in basic mode`);
          
          accounts.forEach(account => {
            if (!account.owner) {
              console.log('Warning: Account missing owner:', account);
              return;
            }
            
            allHolders.add(account.owner);
            allAccounts.push({
              owner: account.owner,
              address: account.address,
              amount: account.amount,
              decimals: 6  // Many SPL tokens use 6 or 9 decimals
            });
            
            if (account.amount) {
              const amount = parseFloat(account.amount);
              if (!isNaN(amount)) {
                totalTokenSupply += amount;
              }
            }
          });
          
          // Return basic analysis
          const uniqueHolderCount = allHolders.size;
          
          // Calculate holder balances
          const holderBalances = {};
          allAccounts.forEach(account => {
            const owner = account.owner;
            const amount = parseFloat(account.amount) || 0;
            
            if (!holderBalances[owner]) {
              holderBalances[owner] = 0;
            }
            
            holderBalances[owner] += amount;
          });
          
          // Sort by balance
          const sortedHolders = Object.entries(holderBalances)
            .map(([owner, balance]) => ({ owner, balance }))
            .sort((a, b) => b.balance - a.balance);
          
          const result = {
            success: true,
            unique_holder_count: uniqueHolderCount,
            token_accounts_count: allAccounts.length,
            top_holders: sortedHolders.slice(0, Math.min(10, sortedHolders.length)),
            data_source: 'helius_basic'
          };
          
          // Save mock data for development
          if (DEBUG && process.env.USE_MOCKS === 'true') {
            const mockDir = './data/mocks';
            if (!fs.existsSync(mockDir)) {
              fs.mkdirSync(mockDir, { recursive: true });
            }
            fs.writeFileSync(`${mockDir}/${tokenAddress}_holders.json`, JSON.stringify(result, null, 2));
            console.log(`Saved mock data for future development`);
          }
          
          return result;
        }
      } catch (basicError) {
        console.error('ERROR in basic mode:', basicError.message);
        // Continue to fallback or full pagination
      }
    }
    
    // Skip full pagination if we're in basic mode and already got an error
    if (options.maxPages === 1 && options.pageSize <= 10) {
      console.log('STEP: fetchAllTokenHolders - Skipping pagination in basic mode, trying fallback');
      throw new Error('Basic mode failed, trying fallback');
    }
    
    // Full pagination mode
    allHolders = new Set(); // Reset in case basic mode partially filled it
    allAccounts = [];
    totalTokenSupply = 0;
    
    while (hasMorePages) {
      if (options.maxPages > 0 && page > options.maxPages) {
        console.log(`STEP: fetchAllTokenHolders - Reached maximum page limit (${options.maxPages})`);
        break;
      }
      
      console.log(`STEP: fetchAllTokenHolders - Fetching page ${page}`);
      
      // Add delay between pages except for the first page
      if (page > 1) {
        await delay(options.delayBetweenPages, true);
      }
      
      const response = await withRetry(async () => {
        const request = {
          jsonrpc: '2.0',
          id: `helius-token-holders-${page}`,
          method: 'getTokenAccounts',
          params: {
            mint: tokenAddress,
            page: page,
            limit: options.pageSize,
            options: {
              showZeroBalance: options.showZeroBalance
            }
          }
        };
        
        if (DEBUG) {
          console.log(`Request for page ${page}:`, JSON.stringify(request));
        }
        
        const res = await axios.post(
          heliusUrl,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'SolanaTokenAnalyzer/1.0'
            },
            timeout: 30000  // Increased timeout
          }
        );
        
        if (!res.data) {
          throw new Error('Empty response from Helius API');
        }
        
        return res;
      }, {
        maxRetries: 5,
        initialDelayMs: 3000,
        maxDelayMs: 60000,
        backoffFactor: 2.5
      });
      
      // Check for valid response
      if (!response.data || !response.data.result) {
        console.error(`Invalid response structure for page ${page}:`, 
          JSON.stringify(response.data).substring(0, 500));
        throw new Error('Invalid response structure from Helius API');
      }
      
      // *** FIX: Extract accounts from token_accounts array ***
      const result = response.data.result;
      const accounts = result.token_accounts;
      
      // Check if accounts is an array
      if (!Array.isArray(accounts)) {
        console.error(`token_accounts for page ${page} is not an array:`, typeof accounts, accounts);
        throw new Error('Expected array of token_accounts but got: ' + typeof accounts);
      }
      
      if (accounts.length === 0) {
        console.log(`STEP: fetchAllTokenHolders - No more results. Total pages: ${page - 1}`);
        hasMorePages = false;
        break;
      }
      
      console.log(`STEP: fetchAllTokenHolders - Received ${accounts.length} accounts on page ${page}`);
      
      // Process the holders (update property access for the new structure)
      accounts.forEach(account => {
        if (!account.owner) {
          console.log('Warning: Account missing owner:', account);
          return;
        }
        
        allHolders.add(account.owner);
        allAccounts.push({
          owner: account.owner,
          address: account.address,
          amount: account.amount,
          decimals: 6  // Most SPL tokens use 6 or 9 decimals
        });
        
        // Calculate total supply based on account amounts
        if (account.amount) {
          const amount = parseFloat(account.amount);
          if (!isNaN(amount)) {
            totalTokenSupply += amount;
          }
        }
      });
      
      // Check if we got fewer results than requested, indicating last page
      if (accounts.length < options.pageSize) {
        hasMorePages = false;
        console.log(`STEP: fetchAllTokenHolders - Last page reached with ${accounts.length} results`);
      } else {
        // Move to next page
        page++;
      }
    }
    
    const uniqueHolderCount = allHolders.size;
    console.log(`STEP: fetchAllTokenHolders - Complete. Found ${uniqueHolderCount} unique holders across ${allAccounts.length} accounts`);
    
    // Calculate top holders by amount
    const holderBalances = {};
    allAccounts.forEach(account => {
      const owner = account.owner;
      const amount = parseFloat(account.amount) || 0;
      
      if (!holderBalances[owner]) {
        holderBalances[owner] = 0;
      }
      
      holderBalances[owner] += amount;
    });
    
    // Convert to array and sort by balance
    const sortedHolders = Object.entries(holderBalances)
      .map(([owner, balance]) => ({ owner, balance }))
      .sort((a, b) => b.balance - a.balance);
    
    // Calculate concentration metrics
    const top10Holders = sortedHolders.slice(0, Math.min(10, sortedHolders.length));
    const top10Concentration = totalTokenSupply > 0 
      ? top10Holders.reduce((sum, holder) => sum + holder.balance, 0) / totalTokenSupply * 100 
      : 0;
    
    const holdersData = {
      success: true,
      unique_holder_count: uniqueHolderCount,
      token_accounts_count: allAccounts.length,
      top_holders: top10Holders,
      top10_concentration_percent: parseFloat(top10Concentration.toFixed(2)),
      holders_by_balance_range: calculateHolderDistribution(holderBalances, totalTokenSupply),
      data_source: 'helius_paginated'
    };
    
    // Save to file if requested
    if (options.saveToFile) {
      try {
        // Ensure the directory exists
        if (!fs.existsSync(options.outputDir)) {
          fs.mkdirSync(options.outputDir, { recursive: true });
        }
        
        const filename = path.join(options.outputDir, `${tokenAddress}_holders.json`);
        fs.writeFileSync(filename, JSON.stringify(holdersData, null, 2));
        console.log(`STEP: fetchAllTokenHolders - Saved holders data to ${filename}`);
      } catch (fileError) {
        console.error('ERROR in file writing:', fileError);
      }
    }
    
    // Save mock data for development
    if (DEBUG && process.env.USE_MOCKS === 'true') {
      const mockDir = './data/mocks';
      if (!fs.existsSync(mockDir)) {
        fs.mkdirSync(mockDir, { recursive: true });
      }
      fs.writeFileSync(`${mockDir}/${tokenAddress}_holders.json`, JSON.stringify(holdersData, null, 2));
      console.log(`Saved mock data for future development`);
    }
    
    return holdersData;
  } catch (error) {
    console.error('ERROR in fetchAllTokenHolders:', error.message);
    
    // Try fallback to Solana RPC if Helius fails and we're only looking for basic info
    if (options.maxPages === 1 && options.pageSize <= 10) {
      try {
        console.log('STEP: fetchAllTokenHolders - Helius API failed, trying fallback to Solana RPC');
        const mintPubkey = new PublicKey(tokenAddress);
        
        // Use withRetry for RPC call
        const largestAccounts = await withRetry(async () => {
          return await connection.getTokenLargestAccounts(mintPubkey);
        }, {
          maxRetries: 3,
          initialDelayMs: 2000,
          maxDelayMs: 30000,
          backoffFactor: 2
        });
        
        console.log('STEP: fetchAllTokenHolders - Fallback successful, largest accounts count:', largestAccounts.value.length);
        
        const result = {
          success: true,
          unique_holder_count: largestAccounts.value.length,
          token_accounts_count: largestAccounts.value.length,
          top_holders: largestAccounts.value.map(acc => ({
            owner: "unknown", // RPC doesn't provide owner info
            address: acc.address.toString(),
            balance: acc.amount.toString()
          })),
          data_source: 'solana_rpc_fallback'
        };
        
        // Save mock data for development
        if (DEBUG && process.env.USE_MOCKS === 'true') {
          const mockDir = './data/mocks';
          if (!fs.existsSync(mockDir)) {
            fs.mkdirSync(mockDir, { recursive: true });
          }
          fs.writeFileSync(`${mockDir}/${tokenAddress}_holders.json`, JSON.stringify(result, null, 2));
          console.log(`Saved mock data for future development`);
        }
        
        return result;
      } catch (fallbackError) {
        console.error('ERROR in fallback:', fallbackError.message);
      }
    }
    
    // If all attempts failed, return error with partial data if available
    return {
      success: false,
      error: `Failed to fetch token holders: ${error.message}`,
      unique_holder_count: allHolders.size || 0,
      token_accounts_count: allAccounts.length || 0,
      top_holders: allHolders.size > 0 ? [] : null,
      data_source: 'failed_with_partial_data'
    };
  }
}

/**
 * Calculate distribution of holders by balance ranges
 * @param {Object} holderBalances - Map of holder address to balance
 * @param {number} totalSupply - Total token supply
 * @returns {Array} Distribution of holders by balance range
 */
function calculateHolderDistribution(holderBalances, totalSupply) {
  // Define balance ranges as percentages of total supply
  const ranges = [
    { name: "Whales (>1%)", min: 0.01 * totalSupply, count: 0 },
    { name: "Large (0.1-1%)", min: 0.001 * totalSupply, max: 0.01 * totalSupply, count: 0 },
    { name: "Medium (0.01-0.1%)", min: 0.0001 * totalSupply, max: 0.001 * totalSupply, count: 0 },
    { name: "Small (<0.01%)", max: 0.0001 * totalSupply, count: 0 }
  ];
  
  // Count holders in each range
  Object.values(holderBalances).forEach(balance => {
    for (const range of ranges) {
      if (
        (!range.min || balance >= range.min) &&
        (!range.max || balance < range.max)
      ) {
        range.count++;
        break;
      }
    }
  });
  
  return ranges;
}

/**
 * Analyze holder data for a token
 * @param {string} tokenAddress - Token mint address 
 * @param {Object} options - Analysis options
 * @returns {Object} Detailed holder analysis
 */
async function analyzeTokenHolderDistribution(tokenAddress, options = {
  fetchFullList: true,
  pageSize: DEBUG ? 10 : 100,
  maxPages: DEBUG ? 2 : 10,
  delayBetweenPages: DEBUG ? 5000 : 2000,
  showZeroBalance: false
}) {
  console.log(`STEP: analyzeTokenHolderDistribution - Starting for: ${tokenAddress}`);
  
  try {
    // Use a single function with different parameters based on need
    if (!options.fetchFullList) {
      console.log('STEP: analyzeTokenHolderDistribution - Using basic holder data (limited to first page)');
      // For basic mode, just get the first page with limited results
      return await fetchAllTokenHolders(tokenAddress, {
        saveToFile: false,
        pageSize: 10,
        maxPages: 1,
        delayBetweenPages: 3000,
        showZeroBalance: options.showZeroBalance
      });
    }
    
    // Otherwise fetch the full paginated list
    console.log('STEP: analyzeTokenHolderDistribution - Fetching complete holder list with pagination');
    return await fetchAllTokenHolders(tokenAddress, {
      saveToFile: options.saveToFile,
      outputDir: options.outputDir || './data',
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      delayBetweenPages: options.delayBetweenPages,
      showZeroBalance: options.showZeroBalance
    });
  } catch (error) {
    console.error('ERROR in analyzeTokenHolderDistribution:', error.message);
    return {
      success: false,
      error: `Failed to analyze token holder distribution: ${error.message}`
    };
  }
}

// Test function for debugging
async function testHeliusAPI(tokenAddress) {
  const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  
  try {
    console.log('Testing Helius API with a simple request...');
    
    const response = await axios.post(
      heliusUrl,
      {
        jsonrpc: '2.0',
        id: 'test-call',
        method: 'getTokenAccounts',
        params: {
          mint: tokenAddress || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          page: 1,
          limit: 2,
          options: {
            showZeroBalance: false
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SolanaTokenAnalyzer/1.0'
        }
      }
    );
    
    console.log("Response status:", response.status);
    console.log("Full response structure:", JSON.stringify(response.data, null, 2));
    console.log("Type of result:", typeof response.data.result);
    console.log("Is Array:", Array.isArray(response.data.result));
    
    if (response.data.result && response.data.result.token_accounts) {
      console.log("token_accounts array:", Array.isArray(response.data.result.token_accounts));
      console.log("Sample account:", JSON.stringify(response.data.result.token_accounts[0], null, 2));
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error("API Test Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return { success: false, error: error.message };
  }
}

export {
  fetchAllTokenHolders,
  analyzeTokenHolderDistribution,
  withRetry,
  delay,
  testHeliusAPI  // Export the test function for debugging
};
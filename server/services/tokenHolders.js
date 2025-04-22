// server/services/tokenHolders.js
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

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
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
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
 * Fetch basic token holder information (non-paginated)
 * @param {string} tokenAddress - Token mint address
 * @param {number} delayMs - Delay in milliseconds to avoid rate limiting
 * @returns {Object} Basic holder distribution data
 */
async function fetchBasicTokenHolders(tokenAddress, delayMs = 1500) {
  console.log('STEP: fetchBasicTokenHolders - Starting for:', tokenAddress);
  
  try {
    // If Helius API key is available, use it for enhanced data
    if (process.env.HELIUS_API_KEY) {
      console.log('STEP: fetchBasicTokenHolders - Using Helius API');
      const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
      console.log(`STEP: fetchBasicTokenHolders - Adding delay of ${delayMs}ms before API request`);
      
      // Add delay before making the request to avoid rate limiting
      await delay(delayMs);
      
      console.log('STEP: fetchBasicTokenHolders - Sending request to Helius');
      const response = await withRetry(async () => {
        const res = await axios.post(
          heliusUrl,
          {
            jsonrpc: "2.0",
            id: "helius-holders",
            method: "searchAssets",
            params: {
              ownerAddress: "",
              grouping: ["mint", "owner"],
              groupByMint: tokenAddress,
              limit: 10
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'SolanaTokenAnalyzer/1.0' // Adding a user agent
            },
            timeout: 15000 // 15 second timeout
          }
        );
        
        if (!res.data || !res.data.result) {
          throw new Error('Invalid response from Helius API');
        }
        
        return res;
      }, {
        maxRetries: 4,
        initialDelayMs: delayMs,
        maxDelayMs: 30000,
        backoffFactor: 2
      });
      
      if (response.data && response.data.result) {
        const result = response.data.result;
        console.log('STEP: fetchBasicTokenHolders - Helius data received, holder count:', result.total || 0);
        
        return {
          success: true,
          holder_count: result.total || 0,
          top_holders: result.items || [],
          data_source: 'helius'
        };
      } else {
        console.log('STEP: fetchBasicTokenHolders - No data in Helius response, falling back');
      }
    } else {
      console.log('STEP: fetchBasicTokenHolders - No Helius API key, using fallback');
    }
    
    // Fallback logic if Helius is unavailable
    console.log('STEP: fetchBasicTokenHolders - Fetching largest token accounts');
    const mintPubkey = new PublicKey(tokenAddress);
    
    // Use withRetry for RPC call
    const largestAccounts = await withRetry(async () => {
      return await connection.getTokenLargestAccounts(mintPubkey);
    }, {
      maxRetries: 4,
      initialDelayMs: delayMs,
      maxDelayMs: 30000,
      backoffFactor: 2
    });
    
    console.log('STEP: fetchBasicTokenHolders - Largest accounts received, count:', largestAccounts.value.length);
    
    const result = {
      success: true,
      holder_count: largestAccounts.value.length,
      largest_accounts: largestAccounts.value.map(acc => ({
        address: acc.address.toString(),
        amount: acc.amount
      })),
      data_source: 'solana_rpc'
    };
    
    console.log('STEP: fetchBasicTokenHolders - Complete, returning data');
    return result;
  } catch (error) {
    console.error('ERROR in fetchBasicTokenHolders:', error.message);
    return {
      success: false,
      error: `Failed to analyze token holders: ${error.message}`
    };
  }
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
 * @returns {Object} Token holders data
 */
async function fetchAllTokenHolders(tokenAddress, options = {
  saveToFile: false,
  outputDir: './data',
  pageSize: 1000,
  maxPages: 0, // 0 means fetch all pages
  delayBetweenPages: 1500
}) {
  console.log(`STEP: fetchAllTokenHolders - Starting for: ${tokenAddress}`);
  
  if (!process.env.HELIUS_API_KEY) {
    console.error('ERROR: HELIUS_API_KEY is required for fetchAllTokenHolders');
    return {
      success: false,
      error: 'HELIUS_API_KEY is required for this operation'
    };
  }

  try {
    console.log('STEP: fetchAllTokenHolders - Validating token address');
    // Validate token address
    const mintPubkey = new PublicKey(tokenAddress);
    
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    let page = 1;
    let allHolders = new Set();
    let allAccounts = [];
    let totalTokenSupply = 0;
    let hasMorePages = true;
    
    console.log(`STEP: fetchAllTokenHolders - Starting pagination with page size: ${options.pageSize}`);
    
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
        const fetchResponse = await fetch(heliusUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SolanaTokenAnalyzer/1.0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'helius-token-holders',
            method: 'getTokenAccounts',
            params: {
              page,
              limit: options.pageSize,
              displayOptions: {},
              mint: tokenAddress
            }
          })
        });
        
        // Check for HTTP errors
        if (!fetchResponse.ok) {
          throw new Error(`HTTP error: ${fetchResponse.status}, ${fetchResponse.statusText}`);
        }
        
        const data = await fetchResponse.json();
        
        // Check for Helius API errors
        if (data.error) {
          throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
        }
        
        return data;
      }, {
        maxRetries: 5,
        initialDelayMs: 2000,
        maxDelayMs: 45000,
        backoffFactor: 2.5
      });
      
      // Check if we have any results
      if (!response.result || !response.result.token_accounts || response.result.token_accounts.length === 0) {
        console.log(`STEP: fetchAllTokenHolders - No more results. Total pages: ${page - 1}`);
        hasMorePages = false;
        break;
      }
      
      console.log(`STEP: fetchAllTokenHolders - Received ${response.result.token_accounts.length} accounts on page ${page}`);
      
      // Process the holders
      response.result.token_accounts.forEach(account => {
        allHolders.add(account.owner);
        allAccounts.push({
          owner: account.owner,
          address: account.account,
          amount: account.amount,
          decimals: account.decimals
        });
        
        // Calculate total supply based on account amounts
        if (account.amount && account.decimals) {
          const amount = parseFloat(account.amount);
          if (!isNaN(amount)) {
            totalTokenSupply += amount;
          }
        }
      });
      
      // Move to next page
      page++;
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
    const top10Holders = sortedHolders.slice(0, 10);
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
    
    return holdersData;
  } catch (error) {
    console.error('ERROR in fetchAllTokenHolders:', error.message);
    return {
      success: false,
      error: `Failed to fetch token holders: ${error.message}`
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
 * Analyze holder data for a token using the full holder list
 * @param {string} tokenAddress - Token mint address 
 * @param {Object} options - Analysis options
 * @returns {Object} Detailed holder analysis
 */
async function analyzeTokenHolderDistribution(tokenAddress, options = {
  fetchFullList: true,
  pageSize: 1000,
  maxPages: 10,
  delayBetweenPages: 1500
}) {
  console.log(`STEP: analyzeTokenHolderDistribution - Starting for: ${tokenAddress}`);
  
  try {
    // If full list isn't needed, use the simple method
    if (!options.fetchFullList) {
      console.log('STEP: analyzeTokenHolderDistribution - Using basic holder data (non-paginated)');
      return await fetchBasicTokenHolders(tokenAddress, 1500);
    }
    
    // Otherwise fetch the full paginated list
    console.log('STEP: analyzeTokenHolderDistribution - Fetching complete holder list with pagination');
    const holdersData = await fetchAllTokenHolders(tokenAddress, {
      saveToFile: options.saveToFile,
      outputDir: options.outputDir || './data',
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      delayBetweenPages: options.delayBetweenPages
    });
    
    return holdersData;
  } catch (error) {
    console.error('ERROR in analyzeTokenHolderDistribution:', error.message);
    return {
      success: false,
      error: `Failed to analyze token holder distribution: ${error.message}`
    };
  }
}

export {
  fetchAllTokenHolders,
  fetchBasicTokenHolders,
  analyzeTokenHolderDistribution,
  withRetry,
  delay
};
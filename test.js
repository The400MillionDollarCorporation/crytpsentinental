// test.js
// Test script to verify key components of SolanaSentinel
import * as dotenv from 'dotenv';
import { analyzeGithubRepo } from './server/services/github.js';
import { fetchProgramData } from './server/services/solanaProgram.js';
import { getTokenDetails } from './server/services/tokenData.js';
import ResearchBot from './server/agents/researchBot.js';

// Load environment variables
dotenv.config();

async function runTests() {
  console.log('🧪 Running SolanaSentinel component tests...');
  
  try {
    // Test 1: GitHub Analysis
    console.log('\n📊 Testing GitHub analysis...');
    const githubUrl = 'https://github.com/solana-labs/solana-program-library';
    const githubData = await analyzeGithubRepo(githubUrl);
    console.log('GitHub analysis result:', 
      githubData.error ? `Error: ${githubData.error}` : 'Success!');
    
    // Test 2: Solana Program Analysis
    console.log('\n📊 Testing Solana program analysis...');
    // Example: Serum DEX program
    const programAddress = 'DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY';
    try {
      const programData = await fetchProgramData(programAddress);
      console.log('Program data:', programData ? 'Success!' : 'Failed');
    } catch (err) {
      console.log('Program analysis error:', err.message);
    }
    
    // Test 3: Token Data Analysis
    console.log('\n📊 Testing token data analysis...');
    // Example: Solana token mint address - USDC on Solana
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; 
    try {
      const tokenData = await getTokenDetails(tokenAddress);
      console.log('Token data:', tokenData ? 'Success!' : 'Failed');
    } catch (err) {
      console.log('Token data error:', err.message);
    }
    
    // Test 4: ResearchBot
    console.log('\n📊 Testing ResearchBot initialization...');
    const bot = new ResearchBot();
    console.log('ResearchBot:', bot ? 'Success!' : 'Failed');
    
    console.log('\n✅ Tests completed');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run tests
runTests();
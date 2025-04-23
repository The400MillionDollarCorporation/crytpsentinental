// test-helius.js

import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();
 
async function testHeliusAPI() {
  const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  
  try {
    const response = await axios.post(
      heliusUrl,
      {
        jsonrpc: '2.0',
        id: 'test-call',
        method: 'getTokenAccounts',
        params: {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
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
          'User-Agent': 'TestApp/1.0'
        }
      }
    );
    
    console.log("Full response structure:", JSON.stringify(response.data, null, 2));
    console.log("Type of result:", typeof response.data.result);
    console.log("Is Array:", Array.isArray(response.data.result));
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

testHeliusAPI();
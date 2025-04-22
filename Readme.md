# SolanaSentinel

SolanaSentinel is an AI-powered cryptocurrency research and trading platform focused on Solana projects. It automates the analysis of crypto projects by examining GitHub repositories, Solana programs, and token metrics to provide comprehensive investment recommendations.

## Features

- **Multi-Source Analysis**
  - GitHub repository metrics and activity assessment
  - Solana program security analysis
  - Token performance metrics
  - Risk/reward evaluation

- **Flexible Input Processing**
  - GitHub URLs
  - Solana program addresses
  - Project names

- **Interactive Trading Simulation**
  - Trading decision workflow
  - Simulated transaction execution (can be extended to real trading)

- **Conversational Interface**
  - Follow-up questions support
  - Context-aware responses
  - Session management

## Project Structure

```
solana-sentinel/
├── server/
│   ├── index.js                # Express server entry point
│   ├── agents/
│   │   └── researchBot.js      # Main agent logic
│   ├── services/
│   │   ├── github.js           # GitHub analysis
│   │   ├── solanaProgram.js    # Solana program analysis
│   │   └── tokenData.js        # Token metrics
│   └── routes/
│       └── api.js              # API endpoints
├── client/                     # Frontend (to be implemented)
├── .env                        # Environment variables
└── README.md                   # This file
```

## Technologies Used

- **Backend**
  - Express.js: Web framework for Node.js
  - LangChain.js: Framework for AI applications
  - OpenAI API: For analysis and natural language processing
  - Solana Web3.js: For blockchain interactions

- **APIs & Data Sources**
  - GitHub API: Repository analysis
  - Solana RPC API: Program data
  - CoinGecko API: Token market data
  - Solscan/Jupiter APIs: Solana-specific data

## Prerequisites

- Node.js 16+ 
- NPM or Yarn
- Access to required API services:
  - OpenAI API key
  - GitHub personal access token
  - CoinGecko API key (optional, for higher rate limits)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/solana-sentinel.git
cd solana-sentinel
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables by creating a `.env` file (see `.env.example` for required variables).

4. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` with the following endpoints:

- `POST /api/analyze`: Submit initial analysis request
- `POST /api/trading-decision`: Process trading decisions
- `POST /api/followup`: Handle follow-up questions
- `POST /api/reset`: Reset session state
- `GET /health`: Health check endpoint

## API Examples

1. Initial Analysis:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "github.com/solana-labs/solana-program-library", "session_id": "123"}'
```

2. Trading Decision:
```bash
curl -X POST http://localhost:3000/api/trading-decision \
  -H "Content-Type: application/json" \
  -d '{"decision": "yes", "session_id": "123"}'
```

3. Follow-up Question:
```bash
curl -X POST http://localhost:3000/api/followup \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the token's market cap?", "session_id": "123"}'
```

## Future Enhancements

- React/Next.js frontend for interactive analysis
- Real trading execution via wallet integrations
- Social sentiment analysis from Twitter/Discord
- On-chain activity metrics and whale tracking
- Multi-chain support (expand beyond Solana)

## License

MIT

## Acknowledgements

This project was inspired by CryptoSentinel and adapted for Solana blockchain analysis.
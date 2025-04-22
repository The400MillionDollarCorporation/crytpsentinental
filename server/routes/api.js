// server/routes/api.js
import express from 'express';
import ResearchBot from '../agents/researchBot.js';

const router = express.Router();

// Bot state manager to handle multiple sessions
const botInstances = {};

// Helper to get or create a bot instance for a session
function getBotInstance(sessionId) {
  if (!botInstances[sessionId]) {
    botInstances[sessionId] = new ResearchBot();
  }
  return botInstances[sessionId];
}

// Analyze endpoint - Initial query processing
router.post('/analyze', async (req, res) => {
  try {
    const { query, session_id } = req.body;
    
    if (!query || !session_id) {
      return res.status(400).json({ error: 'Query and session_id are required' });
    }
    
    const bot = getBotInstance(session_id);
    const result = await bot.processInitialQuery(query);
    
    res.status(200).json({
      result,
      has_trading_prompt: true
    });
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trading decision endpoint
router.post('/trading-decision', async (req, res) => {
  try {
    const { decision, session_id } = req.body;
    
    if (!decision || !session_id) {
      return res.status(400).json({ error: 'Decision and session_id are required' });
    }
    
    const bot = getBotInstance(session_id);
    if (!bot.state) {
      return res.status(400).json({ error: 'No active analysis session' });
    }
    
    const result = await bot.processTradingDecision(decision);
    
    // Clear bot instance after trading decision
    delete botInstances[session_id];
    
    res.status(200).json({ result });
  } catch (error) {
    console.error('Error in trading-decision endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Follow-up question endpoint
router.post('/followup', async (req, res) => {
  try {
    const { question, session_id } = req.body;
    
    if (!question || !session_id) {
      return res.status(400).json({ error: 'Question and session_id are required' });
    }
    
    const bot = getBotInstance(session_id);
    if (!bot.state) {
      return res.status(400).json({ error: 'No active analysis session' });
    }
    
    const result = await bot.processFollowup(question);
    res.status(200).json({ result });
  } catch (error) {
    console.error('Error in followup endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset session endpoint
router.post('/reset', (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    delete botInstances[session_id];
    res.status(200).json({ status: 'success', message: 'Session reset successfully' });
  } catch (error) {
    console.error('Error in reset endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as apiRoutes };
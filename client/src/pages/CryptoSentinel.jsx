// src/CryptoSentinel.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

// Import layout components
import Hero from '../components/layouts/Hero';
import AnalysisForm from '../components/layouts/AnalysisForm';
import ResultsDisplay from '../components/layouts/ResultsDisplay';

// Import modal components
import FollowUpQuestion from '../components/modals/FollowUpModal';
import TradeExecution from '../components/modals/TradeModal';
import ResponseDisplay from '../components/modals/ResponseModal';

import ApiService from '../services/ApiService';

// Main App
const CryptoSentinel = () => {
  const [view, setView] = useState('hero');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [showResponse, setShowResponse] = useState(false);
  const [error, setError] = useState(null);
  
  // Generate a random session ID on component mount
  useEffect(() => {
    setSessionId(`session_${Math.random().toString(36).substring(2, 15)}`);
  }, []);
  
  // API functions
  const analyzeProject = async (queryText) => {
    setLoading(true);
    setError(null);
    
    try {
      // For demonstration, using a mock result
      // In production, replace with actual API call:
      // const response = await ApiService.analyzeProject(queryText, sessionId);
      // const result = response.result;
      
      // Mock result for demonstration
      await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate API call
      
      const mockResult = {
        code_activity: { 
          rating: 7.8, 
          comment: "Active repository with 4 contributors, 120+ commits in the last 3 months, and 300+ stars showing good community engagement.", 
          error: null 
        },
        smart_contract_risk: { 
          rating: 8.5, 
          comment: "Well-structured contract with proper access controls. No reentrancy or overflow vulnerabilities detected.", 
          error: null 
        },
        token_performance: { 
          rating: 6.2, 
          comment: "CSNL token shows moderate volatility with 15% price increase over 30 days. Market cap of $2.5M indicates early stage.", 
          error: null 
        },
        social_sentiment: { 
          rating: 7.5, 
          comment: "Positive sentiment on Twitter with growing community engagement. 65% positive mentions in the last week.", 
          error: null 
        },
        risk_reward_ratio: 3.8,
        confidence_score: 72,
        final_recommendation: "Moderate Buy - The project shows strong development activity and solid technical fundamentals. Token price is at an early stage with room for growth. Consider a small position with defined stop-loss."
      };
      
      setAnalysisResult(mockResult);
      setLoading(false);
      setView('results');
    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
      setLoading(false);
    }
  };
  
  const processFollowUp = async (question) => {
    setFollowUpLoading(true);
    setError(null);
    
    try {
      // For demonstration, using a mock response
      // In production, replace with actual API call:
      // const response = await ApiService.submitFollowupQuestion(question, sessionId);
      // const result = response.result;
      
      // Mock response for demonstration
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      const mockResponse = `The CSNL token currently has a market capitalization of approximately $2.5 million. This is considered relatively small in the cryptocurrency market, which indicates the project is still in its early stages.

The token has seen moderate growth with a 15% price increase over the past 30 days, showing positive momentum despite market volatility. The daily trading volume averages around $250,000, which provides reasonable liquidity for an early-stage project.`;
      
      setResponseText(mockResponse);
      setFollowUpLoading(false);
      setShowFollowUp(false);
      setShowResponse(true);
    } catch (err) {
      setError(err.message || 'An error occurred processing your question');
      setFollowUpLoading(false);
      setShowFollowUp(false);
    }
  };
  
  const executeTrade = async () => {
    setTradeLoading(true);
    setError(null);
    
    try {
      // For demonstration, using a mock response
      // In production, replace with actual API call:
      // const response = await ApiService.submitTradingDecision('yes', sessionId);
      // const result = response.result;
      
      // Mock trade response for demonstration
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate API call
      
      const mockTradeResponse = `Transaction Complete!

Successfully purchased 250 CSNL tokens.
Transaction Hash: 0x7a2d3b5f8d4c1e6a9b0d2e3f4c5d6e7f8a9b0c1d
Network: Solana
Gas Used: 0.0023 SOL`;
      
      setResponseText(mockTradeResponse);
      setTradeLoading(false);
      setShowTradeModal(false);
      setShowResponse(true);
    } catch (err) {
      setError(err.message || 'An error occurred executing the trade');
      setTradeLoading(false);
      setShowTradeModal(false);
    }
  };
  
  const resetSession = async () => {
    try {
      // For demonstration, simply reset local state
      // In production, add API call:
      // await ApiService.resetSession(sessionId);
      
      // Generate new session ID
      setSessionId(`session_${Math.random().toString(36).substring(2, 15)}`);
      setView('form');
      setQuery('');
      setAnalysisResult(null);
      setError(null);
    } catch (err) {
      setError(err.message || 'An error occurred resetting the session');
    }
  };
  
  // Handlers
  const handleStartAnalysis = () => {
    setView('form');
  };
  
  const handleSubmitAnalysis = (queryText) => {
    setQuery(queryText);
    analyzeProject(queryText);
  };
  
  const handleFollowUp = () => {
    setShowFollowUp(true);
  };
  
  const handleSubmitFollowUp = (question) => {
    processFollowUp(question);
  };
  
  const handleTrade = () => {
    setShowTradeModal(true);
  };
  
  const handleConfirmTrade = () => {
    executeTrade();
  };
  
  const handleCloseResponse = () => {
    setShowResponse(false);
  };
  
  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <AnimatePresence mode="wait">
        {view === 'hero' && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Hero startAnalysis={handleStartAnalysis} />
          </motion.div>
        )}
        
        {view === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AnalysisForm 
              onSubmit={handleSubmitAnalysis} 
              isLoading={loading} 
              goBack={() => setView('hero')}
            />
          </motion.div>
        )}
        
        {view === 'results' && analysisResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ResultsDisplay 
              result={analysisResult} 
              onFollow={handleFollowUp}
              onReset={resetSession}
              onTrade={handleTrade}
              goBack={() => setView('form')}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showFollowUp && (
          <FollowUpQuestion
            onSubmit={handleSubmitFollowUp}
            isLoading={followUpLoading}
            onCancel={() => setShowFollowUp(false)}
          />
        )}
        
        {showTradeModal && (
          <TradeExecution
            onCancel={() => setShowTradeModal(false)}
            onConfirm={handleConfirmTrade}
            isLoading={tradeLoading}
            result={analysisResult}
          />
        )}
        
        {showResponse && (
          <ResponseDisplay 
            response={responseText}
            onClose={handleCloseResponse}
          />
        )}
      </AnimatePresence>
      
      {/* Error display */}
      {error && (
        <motion.div 
          className="fixed bottom-4 right-4 bg-red-600 text-white rounded-lg p-4 shadow-lg max-w-md z-50"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Error</h4>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              className="ml-4 text-white/80 hover:text-white"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CryptoSentinel;
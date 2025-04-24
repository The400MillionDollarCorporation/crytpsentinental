// ApiService.js - Service for CryptoSentinel API

/**
 * Service to handle API calls to the CryptoSentinel backend
 */
class ApiService {
    static API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  
    /**
     * Submit a project analysis request
     * @param {string} query - GitHub URL, Contract Address, or Project Name
     * @param {string} sessionId - Unique session identifier
     * @returns {Promise<object>} - Analysis result
     */
    static async analyzeProject(query, sessionId) {
      try {
        const response = await fetch(`${this.API_URL}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, session_id: sessionId }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Analysis request failed');
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error analyzing project:', error);
        throw error;
      }
    }
  
    /**
     * Submit a trading decision
     * @param {string} decision - "yes" or "no"
     * @param {string} sessionId - Unique session identifier
     * @returns {Promise<object>} - Trading result
     */
    static async submitTradingDecision(decision, sessionId) {
      try {
        const response = await fetch(`${this.API_URL}/trading-decision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ decision, session_id: sessionId }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Trading request failed');
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error submitting trading decision:', error);
        throw error;
      }
    }
  
    /**
     * Submit a follow-up question
     * @param {string} question - Follow-up question
     * @param {string} sessionId - Unique session identifier
     * @returns {Promise<object>} - Response data
     */
    static async submitFollowupQuestion(question, sessionId) {
      try {
        const response = await fetch(`${this.API_URL}/followup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question, session_id: sessionId }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Follow-up request failed');
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error submitting follow-up question:', error);
        throw error;
      }
    }
  
    /**
     * Reset the session
     * @param {string} sessionId - Unique session identifier
     * @returns {Promise<object>} - Reset confirmation
     */
    static async resetSession(sessionId) {
      try {
        const response = await fetch(`${this.API_URL}/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Session reset failed');
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error resetting session:', error);
        throw error;
      }
    }
  }
  
  export default ApiService;
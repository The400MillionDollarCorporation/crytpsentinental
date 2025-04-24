// TradeModal.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Zap } from 'lucide-react';

const TradeExecution = ({ onCancel, onConfirm, isLoading, result }) => {
  return (
    <motion.div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <h3 className="text-xl font-semibold text-white mb-2">Execute Trade</h3>
        <p className="text-gray-400 mb-6">Are you sure you want to purchase this token?</p>
        
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Token</span>
            <span className="text-white font-medium">
              {result?.token_performance?.comment?.split(' ')[0] || "Unknown Token"}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Confidence Score</span>
            <span className="text-white font-medium">{result?.confidence_score?.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Risk/Reward</span>
            <span className="text-white font-medium">{result?.risk_reward_ratio?.toFixed(1)}/5</span>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <motion.button
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center"
            whileHover={{ scale: 1.05, boxShadow: "0 5px 15px rgba(79, 70, 229, 0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Executing Trade...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Confirm Purchase
              </>
            )}
          </motion.button>
          
          <motion.button
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-4 rounded-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TradeExecution;
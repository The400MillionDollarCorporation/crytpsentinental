// ResponseModal.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const ResponseDisplay = ({ response, onClose }) => {
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
        <h3 className="text-xl font-semibold text-white mb-4">Response</h3>
        
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
          <p className="text-gray-300 whitespace-pre-line">{response}</p>
        </div>
        
        <motion.button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Okay
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default ResponseDisplay;
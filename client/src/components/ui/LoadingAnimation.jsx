// LoadingAnimation.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { FadeIn, Pulse } from './AnimationWrappers';

const FadeInMessages = () => {
  const messages = [
    "Scanning GitHub repository metrics...",
    "Analyzing developer activity...",
    "Checking smart contract security...",
    "Examining token performance...",
    "Retrieving social sentiment data...",
    "Generating investment recommendation..."
  ];
  
  const [visibleIndex, setVisibleIndex] = useState(0);
  
  useEffect(() => {
    if (visibleIndex < messages.length - 1) {
      const timeout = setTimeout(() => {
        setVisibleIndex(visibleIndex + 1);
      }, 1300);
      
      return () => clearTimeout(timeout);
    }
  }, [visibleIndex, messages.length]);
  
  return (
    <div className="text-left bg-gray-800 rounded-lg p-4 mt-4 max-w-md mx-auto border border-gray-700">
      {messages.slice(0, visibleIndex + 1).map((message, index) => (
        <FadeIn key={index} delay={index * 0.2} className="flex items-center py-1.5">
          <div className="flex-shrink-0 mr-3">
            {index < visibleIndex ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-5 h-5 text-blue-400" />
              </motion.div>
            )}
          </div>
          <p className="text-gray-300 text-sm">{message}</p>
        </FadeIn>
      ))}
    </div>
  );
};

const LoadingAnimation = () => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md mx-auto">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-8">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{
              width: "100%",
            }}
            transition={{
              duration: 8,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>
      
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <Pulse>
              <p className="text-blue-400 mb-2 font-medium">Analyzing Project...</p>
            </Pulse>
            <FadeInMessages />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoadingAnimation;
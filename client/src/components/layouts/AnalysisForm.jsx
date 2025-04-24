// AnalysisForm.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, RefreshCw, Brain } from 'lucide-react';
import AnimatedBackground from '../AnimatedBackground';
import AnimatedLogo from '../AnimatedLogo';
import LoadingAnimation from '../ui/LoadingAnimation';
import { FadeIn, SlideIn } from '../ui/AnimationWrappers';

const AnalysisForm = ({ onSubmit, isLoading, goBack }) => {
  const [query, setQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
    }
  };
  
  const placeholders = [
    "github.com/username/repo",
    "0x1234567890abcdef1234567890abcdef12345678",
    "project name"
  ];
  
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4">
      <AnimatedBackground />
      <motion.button
        className="absolute top-6 left-6 text-gray-400 hover:text-white"
        onClick={goBack}
        whileHover={{ x: -3 }}
      >
        <div className="flex items-center">
          <ArrowRight className="w-5 h-5 transform rotate-180 mr-2" />
          <span>Back</span>
        </div>
      </motion.button>
      
      <div className="max-w-2xl w-full z-10">
        <FadeIn>
          <div className="flex items-center justify-center mb-8">
            <AnimatedLogo className="w-16 h-16 mb-4" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 text-center">Research Project</h2>
          <p className="text-gray-400 mb-8 text-center">Enter a GitHub URL, contract address, or project name</p>
        </FadeIn>
        
        <SlideIn className="w-full">
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <Search className="w-5 h-5 text-gray-500" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-lg"
                animate={{ 
                  boxShadow: [
                    "0 0 0 rgba(59, 130, 246, 0)", 
                    "0 0 8px rgba(59, 130, 246, 0.3)", 
                    "0 0 0 rgba(59, 130, 246, 0)"
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={placeholderIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={placeholders[placeholderIndex]}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLoading}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            
            <motion.button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  Analyze
                </>
              )}
            </motion.button>
          </form>
        </SlideIn>
        
        {isLoading && (
          <div className="mt-12">
            <LoadingAnimation />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisForm;
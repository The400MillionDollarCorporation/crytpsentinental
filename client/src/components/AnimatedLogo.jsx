// AnimatedLogo.jsx - Creates an animated logo for CryptoSentinel
import React from 'react';
import { motion } from 'framer-motion';

const AnimatedLogo = ({ className = "" }) => {
  return (
    <motion.div 
      className={`relative ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Outer rotating ring */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
          <circle 
            cx="50" 
            cy="50" 
            r="48" 
            fill="none" 
            stroke="url(#ringGradient)" 
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        </svg>
      </motion.div>
      
      {/* Middle rotating ring */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle 
            cx="50" 
            cy="50" 
            r="42" 
            fill="none" 
            stroke="#3B82F6" 
            strokeWidth="0.75"
            strokeDasharray="5,5"
            strokeOpacity="0.6"
          />
        </svg>
      </motion.div>
      
      {/* Inner circle with glow */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        animate={{ 
          boxShadow: [
            "0 0 0px rgba(59, 130, 246, 0)",
            "0 0 20px rgba(59, 130, 246, 0.5)",
            "0 0 0px rgba(59, 130, 246, 0)"
          ]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="w-4/5 h-4/5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 opacity-50 blur-sm"></div>
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-800 to-gray-900"></div>
          
          {/* Eye icon */}
          <motion.div
            className="relative"
            animate={{ 
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 mx-auto text-blue-400">
              <path 
                fill="currentColor" 
                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
              />
            </svg>
            
            {/* Glowing center */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ 
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-1/4 h-1/4 rounded-full bg-blue-400 blur-sm"></div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Floating particles */}
      <FloatingParticle 
        size={3}
        color="#3B82F6"
        position={{ top: '20%', left: '10%' }}
        duration={5}
      />
      <FloatingParticle 
        size={2}
        color="#60A5FA"
        position={{ top: '70%', left: '15%' }}
        duration={7}
      />
      <FloatingParticle 
        size={4}
        color="#4F46E5"
        position={{ top: '30%', right: '15%' }}
        duration={6}
      />
      <FloatingParticle 
        size={2.5}
        color="#818CF8"
        position={{ bottom: '20%', right: '10%' }}
        duration={8}
      />
    </motion.div>
  );
};

// Floating particle component
const FloatingParticle = ({ size, color, position, duration }) => {
  const randomPath = [
    { x: 0, y: 0 },
    { x: 5, y: -5 },
    { x: -5, y: -10 },
    { x: 0, y: -5 },
    { x: 0, y: 0 }
  ];
  
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        ...position,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color
      }}
      animate={{ 
        x: randomPath.map(point => point.x),
        y: randomPath.map(point => point.y),
      }}
      transition={{ 
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

export default AnimatedLogo;
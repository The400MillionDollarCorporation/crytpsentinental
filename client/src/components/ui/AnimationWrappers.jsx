// AnimationWrappers.jsx
import React from 'react';
import { motion } from 'framer-motion';

export const FadeIn = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SlideIn = ({ children, direction = "right", delay = 0, className = "" }) => {
  const xValue = direction === "right" ? 50 : -50;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: xValue }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const Pulse = ({ children }) => (
  <motion.div
    animate={{ 
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
    }}
    transition={{ 
      duration: 2.5, 
      repeat: Infinity,
      ease: "easeInOut" 
    }}
  >
    {children}
  </motion.div>
);
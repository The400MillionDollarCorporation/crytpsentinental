// MetricItem.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FadeIn } from './AnimationWrappers';

const MetricItem = ({ title, rating, comment, error, delay }) => {
  return (
    <FadeIn delay={delay} className="mb-5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className="text-white font-medium">{rating.toFixed(1)}/10</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
        <motion.div 
          className={`h-full ${
            rating > 7 ? 'bg-green-500' : 
            rating > 4 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${(rating / 10) * 100}%` }}
          transition={{ duration: 1, delay }}
        />
      </div>
      <p className="text-sm text-gray-400">{error ? `Error: ${error}` : comment}</p>
    </FadeIn>
  );
};

export default MetricItem;
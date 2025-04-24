// ResultsDisplay.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, PiggyBank, Search, RefreshCw, Zap } from 'lucide-react';
import AnimatedBackground from '../AnimatedBackground';
import AnimatedLogo from '../AnimatedLogo';
import AnimatedMetrics from '../AnimatedMetrics';
import MetricItem from '../ui/MetricItem';
import { FadeIn, SlideIn } from '../ui/AnimationWrappers';

const ResultsDisplay = ({ result, onFollow, onReset, onTrade, goBack }) => {
  // Extract data from analysis result
  const { code_activity, smart_contract_risk, token_performance, social_sentiment, risk_reward_ratio, confidence_score, final_recommendation } = result;
  
  return (
   // ResultsDisplay.jsx (continued)
   <div className="bg-gray-900 min-h-screen py-12 px-4 relative">
   <AnimatedBackground />
   <motion.button
     className="absolute top-6 left-6 text-gray-400 hover:text-white z-10"
     onClick={goBack}
     whileHover={{ x: -3 }}
   >
     <div className="flex items-center">
       <ArrowRight className="w-5 h-5 transform rotate-180 mr-2" />
       <span>Back</span>
     </div>
   </motion.button>
   
   <div className="max-w-4xl mx-auto relative z-10">
     <FadeIn>
       <div className="flex items-center justify-center mb-6">
         <AnimatedLogo className="w-14 h-14" />
       </div>
       <div className="flex items-center justify-between mb-8">
         <h1 className="text-3xl font-bold text-white">Investment Analysis</h1>
         <div className="flex space-x-3">
           <motion.button
             className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm flex items-center"
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={onFollow}
           >
             <Search className="w-4 h-4 mr-2" />
             Ask Follow-up
           </motion.button>
           <motion.button
             className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm flex items-center"
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={onReset}
           >
             <RefreshCw className="w-4 h-4 mr-2" />
             New Analysis
           </motion.button>
         </div>
       </div>
     </FadeIn>
     
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
       {/* Main metrics */}
       <SlideIn className="bg-gray-800 border border-gray-700 rounded-lg p-6">
         <h3 className="text-lg font-medium text-gray-300 mb-4 flex items-center">
           <PiggyBank className="w-5 h-5 mr-2 text-blue-400" />
           Investment Potential
         </h3>
         
         <div className="mb-4">
           <div className="flex justify-between items-center mb-1">
             <span className="text-gray-400 text-sm">Risk/Reward Ratio</span>
             <span className="text-white font-medium">{risk_reward_ratio.toFixed(1)}/5</span>
           </div>
           <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-gradient-to-r from-green-500 to-blue-500"
               initial={{ width: 0 }}
               animate={{ width: `${(risk_reward_ratio / 5) * 100}%` }}
               transition={{ duration: 1, delay: 0.5 }}
             />
           </div>
         </div>
         
         <div className="mb-6">
           <div className="flex justify-between items-center mb-1">
             <span className="text-gray-400 text-sm">Confidence Score</span>
             <span className="text-white font-medium">{confidence_score.toFixed(0)}%</span>
           </div>
           <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
               initial={{ width: 0 }}
               animate={{ width: `${confidence_score}%` }}
               transition={{ duration: 1, delay: 0.7 }}
             />
           </div>
         </div>
         
         <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
           <h4 className="text-lg font-medium text-white mb-2">Recommendation</h4>
           <p className="text-gray-300">{final_recommendation}</p>
         </div>
         
         {/* Add animated metrics visualization */}
         <div className="mt-6">
           <AnimatedMetrics data={result} />
         </div>
       </SlideIn>
       
       {/* Detail metrics */}
       <SlideIn direction="left" className="bg-gray-800 border border-gray-700 rounded-lg p-6">
         <h3 className="text-lg font-medium text-gray-300 mb-4">Analysis Metrics</h3>
         
         <MetricItem 
           title="Code Activity" 
           rating={code_activity.rating} 
           comment={code_activity.comment}
           error={code_activity.error}
           delay={0.1}
         />
         
         <MetricItem 
           title="Smart Contract Security" 
           rating={smart_contract_risk.rating} 
           comment={smart_contract_risk.comment}
           error={smart_contract_risk.error}
           delay={0.3}
         />
         
         <MetricItem 
           title="Token Performance" 
           rating={token_performance.rating} 
           comment={token_performance.comment}
           error={token_performance.error}
           delay={0.5}
         />
         
         <MetricItem 
           title="Social Sentiment" 
           rating={social_sentiment.rating} 
           comment={social_sentiment.comment}
           error={social_sentiment.error}
           delay={0.7}
         />
       </SlideIn>
     </div>
     
     <FadeIn delay={0.5}>
       <motion.button
         className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center"
         whileHover={{ scale: 1.03, boxShadow: "0 10px 25px rgba(79, 70, 229, 0.4)" }}
         whileTap={{ scale: 0.98 }}
         onClick={onTrade}
       >
         <span className="mr-2">Execute Trade</span>
         <Zap className="w-5 h-5" />
       </motion.button>
     </FadeIn>
   </div>
 </div>
);
};

export default ResultsDisplay;
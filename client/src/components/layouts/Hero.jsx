// Hero.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Zap, Github, AlertTriangle, BarChart4, ArrowRight } from 'lucide-react';
import AnimatedBackground from '../AnimatedBackground';
import AnimatedLogo from '../AnimatedLogo';
import FeatureCard from '../ui/FeatureCard';
import { FadeIn } from '../ui/AnimationWrappers';

const Hero = ({ startAnalysis }) => {
  return (
    <div className="relative bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      <AnimatedBackground />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI3NjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IHgxPSIxMDAlIiB5MT0iMTAwJSIgeDI9IjAlIiB5Mj0iMCUiIGlkPSJhIj48c3RvcCBzdG9wLWNvbG9yPSIjMTIxRDMzIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzExMTgyNyIgb2Zmc2V0PSIxMDAlIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHBhdGggZD0iTS01ODIuNjg3IDEyNS44M2MxNDQuNzY1LTI0Mi40MSA0MzcuMTc0LTMyMC4wMDEgNjc5LjU4NC0xNzUuMjM3bDY2NC4xNDQgMzk1LjU5YzI0Mi40MSAxNDQuNzY1IDMyMC4wMDEgNDM3LjE3NCAxNzUuMjM3IDY3OS41ODRsLTM5NS41OSA2NjQuMTQ1Yy0xNDQuNzY1IDI0Mi40MS00MzcuMTc0IDMyMC4wMDEtNjc5LjU4NCAxNzUuMjM3bC02NjQuMTQ1LTM5NS41OWMtMjQyLjQxLTE0NC43NjUtMzIwLjAwMS00MzcuMTc0LTE3NS4yMzctNjc5LjU4NGwzOTUuNTktNjY0LjE0NXoiIGZpbGw9InVybCgjYSkiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZmlsbC1vcGFjaXR5PSIuMSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjgzLjgxMyAtMjMuNzEzKSIvPjwvc3ZnPg==')] bg-no-repeat bg-cover opacity-30"></div>
        <Sparkles className="absolute right-1/4 top-1/4 text-blue-300 opacity-20 w-12 h-12" />
        <Sparkles className="absolute left-1/3 bottom-1/3 text-blue-300 opacity-20 w-8 h-8" />
        <TrendingUp className="absolute left-1/4 top-1/3 text-green-300 opacity-20 w-10 h-10" />
      </div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <FadeIn>
          <div className="flex items-center justify-center mb-8">
            <AnimatedLogo className="w-20 h-20 mb-4" />
          </div>
          <motion.div
            className="flex items-center justify-center space-x-2 mb-6"
            animate={{ rotate: [0, 5, 0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            <Zap className="w-8 h-8 text-yellow-400" />
            <h2 className="text-xl font-semibold text-yellow-400 tracking-wider">CRYPTO SENTINEL</h2>
            <Zap className="w-8 h-8 text-yellow-400" />
          </motion.div>
        </FadeIn>
        
        <FadeIn delay={0.2}>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
            AI-Powered <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">Crypto Research</span> & Trading Bot
          </h1>
        </FadeIn>
        
        <FadeIn delay={0.4}>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Comprehensive analysis, security scanning, and trading execution in one powerful platform
          </p>
        </FadeIn>
        
        <FadeIn delay={0.6}>
          <div className="max-w-md mx-auto">
            <motion.button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              onClick={startAnalysis}
            >
              <span className="mr-2">Start Research</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </FadeIn>
      </div>
      
      <FadeIn delay={0.8} className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        <FeatureCard 
          icon={Github} 
          title="GitHub Analysis" 
          description="Evaluate repository metrics, developer activity, and code quality" 
          delay={0.8}
        />
        <FeatureCard 
          icon={AlertTriangle} 
          title="Security Scanning" 
          description="Smart contract security analysis to detect vulnerabilities" 
          delay={1}
        />
        <FeatureCard 
          icon={BarChart4} 
          title="Market Metrics" 
          description="Real-time token performance and social sentiment analysis" 
          delay={1.2}
        />
      </FadeIn>
    </div>
  );
};

export default Hero;
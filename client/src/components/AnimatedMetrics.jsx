// AnimatedMetrics.jsx - Creates animated charts for token metrics
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const AnimatedMetrics = ({ data = {} }) => {
  const {
    code_activity = { rating: 7.8 },
    smart_contract_risk = { rating: 8.5 },
    token_performance = { rating: 6.2 },
    social_sentiment = { rating: 7.5 },
    risk_reward_ratio = 3.8,
    confidence_score = 72
  } = data;

  const [priceHistory, setPriceHistory] = useState([]);
  const [socialActivity, setSocialActivity] = useState([]);
  const [activeTab, setActiveTab] = useState('price');
  
  // Generate mock price history data
  useEffect(() => {
    // Generate realistic-looking price data based on token_performance rating
    const basePrice = 0.005 + (token_performance.rating / 10) * 0.045;
    const volatility = 1 - (token_performance.rating / 15); // Higher rating = lower volatility
    
    const generatePriceHistory = () => {
      let price = basePrice;
      const history = [];
      
      // Generate 30 days of price data
      for (let i = 30; i >= 0; i--) {
        const randomChange = (Math.random() - 0.45) * volatility * 0.08;
        price = price * (1 + randomChange);
        price = Math.max(0.001, price); // Ensure price doesn't go too low
        
        history.push({
          day: i,
          price: price
        });
      }
      
      return history;
    };
    
    // Generate social activity data
    const generateSocialActivity = () => {
      const baseMentions = 30 + (social_sentiment.rating * 10);
      const trend = (social_sentiment.rating - 5) / 20; // Trend direction based on rating
      
      const activity = [];
      
      for (let i = 14; i >= 0; i--) {
        const dayFactor = Math.max(0.5, Math.min(1.5, 1 + (trend * (14-i)/14)));
        const randomFactor = 0.8 + Math.random() * 0.4;
        const mentions = Math.round(baseMentions * dayFactor * randomFactor);
        
        activity.push({
          day: i,
          mentions: mentions,
          positive: Math.round(mentions * (0.5 + social_sentiment.rating / 20))
        });
      }
      
      return activity;
    };
    
    setPriceHistory(generatePriceHistory());
    setSocialActivity(generateSocialActivity());
  }, [token_performance.rating, social_sentiment.rating]);
  
  // Format price for display
  const formatPrice = (price) => {
    if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 0.1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };
  
  // Custom tooltip for price chart
  const PriceTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-md p-2 text-xs">
          <p className="text-gray-300">Day {payload[0].payload.day}</p>
          <p className="text-blue-400 font-medium">
            ${formatPrice(payload[0].value)}
          </p>
        </div>
      );
    }
    
    return null;
  };
  
  // Custom tooltip for social activity
  const SocialTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const positivePercent = Math.round((payload[1].value / payload[0].value) * 100);
      
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-md p-2 text-xs">
          <p className="text-gray-300">Day {payload[0].payload.day}</p>
          <p className="text-blue-400">Total: {payload[0].value}</p>
          <p className="text-green-400">Positive: {payload[1].value} ({positivePercent}%)</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="mt-6">
      <div className="flex justify-center mb-4">
        <div className="bg-gray-900 rounded-lg p-1 inline-flex">
          <button
            className={`px-4 py-1.5 text-sm rounded-md ${
              activeTab === 'price' 
                ? 'bg-gray-800 text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('price')}
          >
            Price History
          </button>
          <button
            className={`px-4 py-1.5 text-sm rounded-md ${
              activeTab === 'social' 
                ? 'bg-gray-800 text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('social')}
          >
            Social Activity
          </button>
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="h-52"
      >
        {activeTab === 'price' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceHistory}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                stroke="#4B5563" 
                tickFormatter={(value) => `D-${value}`}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="#4B5563" 
                tickFormatter={(value) => `${formatPrice(value)}`}
                tick={{ fontSize: 10 }}
                width={60}
              />
              <Tooltip content={<PriceTooltip />} />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#3B82F6" 
                strokeWidth={2}
                fill="url(#priceGradient)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        
        {activeTab === 'social' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={socialActivity}>
              <defs>
                <linearGradient id="mentionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                stroke="#4B5563" 
                tickFormatter={(value) => `D-${value}`}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="#4B5563" 
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<SocialTooltip />} />
              <Area 
                type="monotone" 
                dataKey="mentions" 
                stackId="1"
                stroke="#6366F1" 
                strokeWidth={2}
                fill="url(#mentionsGradient)" 
                animationDuration={1500}
              />
              <Area 
                type="monotone" 
                dataKey="positive" 
                stackId="2"
                stroke="#10B981" 
                strokeWidth={2}
                fill="url(#positiveGradient)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </div>
  );
};

export default AnimatedMetrics;
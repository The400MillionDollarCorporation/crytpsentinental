// FeatureCard.jsx
import React from 'react';
import { SlideIn } from './AnimationWrappers';

const FeatureCard = ({ icon: Icon, title, description, delay }) => {
  return (
    <SlideIn delay={delay}>
      <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-opacity-70 transition-all">
        <div className="flex items-center mb-4">
          <div className="rounded-full bg-blue-900 p-3 mr-4">
            <Icon className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        <p className="text-gray-400">{description}</p>
      </div>
    </SlideIn>
  );
};

export default FeatureCard;
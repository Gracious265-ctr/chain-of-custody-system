import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import '../App.css';

const StatCard = ({ 
  icon, 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue,
  color = '#0f3460',
  onClick,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="stat-card stat-card-loading">
        <div className="stat-card-header">
          <div className="stat-card-icon-skeleton" />
          <div className="stat-card-trend-skeleton" />
        </div>
        <div className="stat-card-body">
          <div className="stat-card-title-skeleton" />
          <div className="stat-card-value-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="stat-card"
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: color }}>
          <FontAwesomeIcon icon={icon} />
        </div>
        {trend && (
          <div className={`stat-card-trend ${trend === 'up' ? 'trend-up' : 'trend-down'}`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}%
          </div>
        )}
      </div>
      
      <div className="stat-card-body">
        <h3 className="stat-card-title">{title}</h3>
        <div className="stat-card-value">{value}</div>
        {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
      </div>
    </motion.div>
  );
};

export default StatCard;

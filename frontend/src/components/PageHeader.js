import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import '../App.css';

const PageHeader = ({ 
  title, 
  subtitle, 
  icon, 
  actions, 
  breadcrumbs,
  className = '' 
}) => {
  return (
    <motion.div 
      className={`page-header ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {breadcrumbs && (
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className="breadcrumb-separator">/</span>}
              {crumb.link ? (
                <a href={crumb.link} className="breadcrumb-link">{crumb.label}</a>
              ) : (
                <span className="breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      
      <div className="page-header-content">
        <div className="page-header-title">
          {icon && <FontAwesomeIcon icon={icon} className="page-header-icon" />}
          <h1>{title}</h1>
        </div>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      
      {actions && (
        <div className="page-header-actions">
          {actions}
        </div>
      )}
    </motion.div>
  );
};

export default PageHeader;
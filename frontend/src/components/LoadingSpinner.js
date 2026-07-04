import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const LoadingSpinner = ({ size = 'medium', message = 'Loading...', fullPage = false }) => {
  const sizeMap = {
    small: '20px',
    medium: '40px',
    large: '60px'
  };

  if (fullPage) {
    return (
      <div className="full-page-loader">
        <div className="loading-spinner-container">
          <FontAwesomeIcon 
            icon={faSpinner} 
            className="loading-spinner" 
            style={{ fontSize: sizeMap[size] || sizeMap.medium }}
            spin
          />
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-spinner-container">
      <FontAwesomeIcon 
        icon={faSpinner} 
        className="loading-spinner" 
        style={{ fontSize: sizeMap[size] || sizeMap.medium }}
        spin
      />
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
import React from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, faExclamationCircle, faInfoCircle, 
  faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';

export const showSuccess = (message) => {
  toast.success(message, {
    duration: 4000,
    position: 'top-right',
    icon: <FontAwesomeIcon icon={faCheckCircle} />
  });
};

export const showError = (message) => {
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
    icon: <FontAwesomeIcon icon={faExclamationCircle} />
  });
};

export const showInfo = (message) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: <FontAwesomeIcon icon={faInfoCircle} />
  });
};

export const showWarning = (message) => {
  toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: <FontAwesomeIcon icon={faExclamationTriangle} />
  });
};

const ToastNotifications = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        className: 'toast-container',
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px',
          fontWeight: '500'
        },
        success: {
          style: {
            background: '#065f46',
            border: '1px solid #10b981'
          }
        },
        error: {
          style: {
            background: '#991b1b',
            border: '1px solid #ef4444'
          }
        }
      }}
    />
  );
};

export default ToastNotifications;
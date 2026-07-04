import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExclamationTriangle, 
  faTimes, 
  faCheckCircle,
  faInfoCircle,
  faQuestionCircle
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

/**
 * ConfirmDialog Component
 * 
 * A reusable confirmation dialog with animations and multiple variants
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls dialog visibility
 * @param {function} props.onClose - Callback when dialog is closed
 * @param {function} props.onConfirm - Callback when confirm button is clicked
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message
 * @param {string} props.confirmText - Text for confirm button
 * @param {string} props.cancelText - Text for cancel button
 * @param {string} props.variant - 'warning' | 'danger' | 'info' | 'success'
 * @param {React.ReactNode} props.customContent - Optional custom content
 */
const ConfirmDialog = ({ 
  isOpen = false,
  onClose = () => {},
  onConfirm = () => {},
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  customContent = null,
  showCloseButton = true,
  confirmButtonProps = {},
  cancelButtonProps = {}
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    warning: {
      icon: faExclamationTriangle,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      confirmBg: '#f59e0b',
      confirmHover: '#d97706',
      confirmColor: '#ffffff'
    },
    danger: {
      icon: faExclamationTriangle,
      color: '#ef4444',
      bgColor: '#fef2f2',
      confirmBg: '#ef4444',
      confirmHover: '#dc2626',
      confirmColor: '#ffffff'
    },
    info: {
      icon: faInfoCircle,
      color: '#3b82f6',
      bgColor: '#eff6ff',
      confirmBg: '#3b82f6',
      confirmHover: '#2563eb',
      confirmColor: '#ffffff'
    },
    success: {
      icon: faCheckCircle,
      color: '#10b981',
      bgColor: '#ecfdf5',
      confirmBg: '#10b981',
      confirmHover: '#059669',
      confirmColor: '#ffffff'
    },
    question: {
      icon: faQuestionCircle,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      confirmBg: '#8b5cf6',
      confirmHover: '#7c3aed',
      confirmColor: '#ffffff'
    }
  };

  const styles = variantStyles[variant] || variantStyles.warning;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleOverlayClick}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          
          <motion.div
            className="dialog-box"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              type: 'spring',
              damping: 25,
              stiffness: 300
            }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '450px',
              width: '90%',
              zIndex: 10000,
              textAlign: 'center',
              position: 'relative',
              border: `1px solid ${styles.color}20`
            }}
          >
            {showCloseButton && (
              <motion.button
                className="dialog-close"
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#718096',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </motion.button>
            )}
            
            <motion.div 
              className="dialog-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
              style={{ 
                color: styles.color,
                marginBottom: '16px',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: styles.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <FontAwesomeIcon icon={styles.icon} size="2x" />
            </motion.div>
            
            <h3 
              className="dialog-title"
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1a202c',
                marginBottom: '8px'
              }}
            >
              {title}
            </h3>
            
            {customContent ? (
              customContent
            ) : (
              <p 
                className="dialog-message"
                style={{
                  color: '#718096',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '24px'
                }}
              >
                {message}
              </p>
            )}
            
            <div 
              className="dialog-actions"
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <motion.button
                className="dialog-btn dialog-cancel"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                {...cancelButtonProps}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#e2e8f0',
                  color: '#4a5568',
                  ...cancelButtonProps.style
                }}
              >
                {cancelText}
              </motion.button>
              
              <motion.button
                className="dialog-btn dialog-confirm"
                onClick={onConfirm}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                {...confirmButtonProps}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: styles.confirmBg,
                  color: styles.confirmColor,
                  ...confirmButtonProps.style
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = styles.confirmHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = styles.confirmBg;
                }}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

ConfirmDialog.defaultProps = {
  isOpen: false,
  onClose: () => {},
  onConfirm: () => {},
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'warning',
  customContent: null,
  showCloseButton: true,
  confirmButtonProps: {},
  cancelButtonProps: {}
};

export default ConfirmDialog;
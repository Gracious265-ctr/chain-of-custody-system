import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faUser, faLock, faSpinner, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { showError } from '../components/ToastNotifications';
import '../App.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    if (result.success) {
      if (result.user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    } else {
      setError(result.error);
      showError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <motion.div 
        className="auth-box"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-brand">
          <div className="auth-brand-icon-wrapper">
            <FontAwesomeIcon icon={faLink} className="auth-brand-icon" />
            <FontAwesomeIcon icon={faShieldAlt} className="auth-brand-shield" />
          </div>
          <h1>Criminal Evidence Chain of Custody</h1>
          <p>Blockchain Evidence Management System</p>
        </div>
        
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to access your dashboard</p>
        
        {error && (
          <motion.div 
            className="error-message"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {error}
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px' }} />
              Username
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Enter your username"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label>
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
              Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter your password"
              className="form-input"
            />
          </div>
          
          <motion.button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>
        
        <div className="auth-footer">
          <p>Contact your administrator if you need assistance.</p>
          <p className="auth-security">
            <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '4px' }} />
            Secured with Blockchain Technology
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
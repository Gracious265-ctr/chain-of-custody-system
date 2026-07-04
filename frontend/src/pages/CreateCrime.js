import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBalanceScale, faSpinner, faPlus } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const CreateCrime = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Crime name is required');
      showError('Crime name is required');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/crimes', 
        { name: name.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(`Crime "${name.trim()}" created successfully!`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create crime');
      showError(err.response?.data?.error || 'Failed to create crime');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Create New Crime"
          subtitle="Add a new crime type to the system"
          icon={faBalanceScale}
        />

        <div className="upload-form">
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Crime Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                placeholder="e.g., Cyber Fraud, Armed Robbery, etc."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: '#f7fafc'
                }}
              />
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                Enter the name of the crime type. This will be available for case creation.
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="auth-btn"
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#a0aec0' : '#0f3460',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                  Creating...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Create Crime
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCrime;
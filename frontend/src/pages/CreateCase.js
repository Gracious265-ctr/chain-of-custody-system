import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, faPlus, faTimes, faExclamationTriangle,
  faCheckCircle, faSpinner 
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const CreateCase = () => {
  const [crimes, setCrimes] = useState([]);
  const [formData, setFormData] = useState({
    caseNumber: '',
    title: '',
    description: '',
    crimeId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // New crime creation state
  const [showNewCrimeModal, setShowNewCrimeModal] = useState(false);
  const [newCrimeName, setNewCrimeName] = useState('');
  const [creatingCrime, setCreatingCrime] = useState(false);
  const [crimeError, setCrimeError] = useState('');

  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCrimes();
  }, []);

  const fetchCrimes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/crimes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCrimes(res.data);
    } catch (err) {
      console.error('Failed to load crimes');
      showError('Failed to load crimes');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.caseNumber || !formData.title || !formData.crimeId) {
      showError('Case Number, Title, and Crime are required');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/cases', 
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess('Case created successfully!');
      navigate('/cases');
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCrime = async (e) => {
    e.preventDefault();
    setCrimeError('');
    
    if (!newCrimeName.trim()) {
      setCrimeError('Please enter a crime name');
      return;
    }

    setCreatingCrime(true);
    try {
      const response = await axios.post('http://localhost:5000/api/crimes', 
        { name: newCrimeName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchCrimes();
      
      setFormData({
        ...formData,
        crimeId: response.data.crimeId
      });
      
      setShowNewCrimeModal(false);
      setNewCrimeName('');
      setCrimeError('');
      
      showSuccess(`Crime "${newCrimeName.trim()}" created and selected successfully!`);
    } catch (err) {
      setCrimeError(err.response?.data?.error || 'Failed to create crime');
      showError(err.response?.data?.error || 'Failed to create crime');
    } finally {
      setCreatingCrime(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Create New Case"
          subtitle="Create an investigation case linked to a crime"
          icon={faFolder}
        />

        <div className="upload-form">
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Case Number</label>
              <input 
                type="text" 
                value={formData.caseNumber} 
                onChange={(e) => setFormData({...formData, caseNumber: e.target.value})} 
                required 
                placeholder="e.g., CASE-2026-001"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: '#f7fafc'
                }}
              />
            </div>
            
            <div className="form-group">
              <label>Case Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                required 
                placeholder="e.g., Mzuni Robbery Investigation"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: '#f7fafc'
                }}
              />
            </div>
            
            <div className="form-group">
              <label>Crime Type</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select 
                  value={formData.crimeId} 
                  onChange={(e) => setFormData({...formData, crimeId: e.target.value})} 
                  required
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    background: 'white'
                  }}
                >
                  <option value="">Select a Crime</option>
                  {crimes.map(c => (
                    <option key={c.crime_id} value={c.crime_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                
                <button
                  type="button"
                  onClick={() => setShowNewCrimeModal(true)}
                  className="btn-success"
                  style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '6px' }} />
                  New Crime
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                Can't find the crime type? Click "New Crime" to add it.
              </p>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                rows="4"
                placeholder="Provide details about the case..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: '#f7fafc',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
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
                  <FontAwesomeIcon icon={faFolder} style={{ marginRight: '8px' }} />
                  Create Case
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* New Crime Modal */}
      {showNewCrimeModal && (
        <div className="dialog-overlay" onClick={() => setShowNewCrimeModal(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button
              onClick={() => {
                setShowNewCrimeModal(false);
                setNewCrimeName('');
                setCrimeError('');
              }}
              className="dialog-close"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <div className="dialog-icon" style={{ color: '#48bb78' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
            </div>

            <h3 className="dialog-title">🚨 Add New Crime</h3>
            <p className="dialog-message">
              Add a new crime type to the system. It will be available for future cases.
            </p>

            {crimeError && (
              <div className="error-message" style={{ marginBottom: '16px' }}>
                {crimeError}
              </div>
            )}

            <form onSubmit={handleCreateCrime}>
              <div className="form-group">
                <label>Crime Name</label>
                <input
                  type="text"
                  value={newCrimeName}
                  onChange={(e) => setNewCrimeName(e.target.value)}
                  placeholder="e.g., Cyber Fraud, Armed Robbery, etc."
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    background: '#f7fafc'
                  }}
                  autoFocus
                />
              </div>

              <div className="dialog-actions" style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCrimeModal(false);
                    setNewCrimeName('');
                    setCrimeError('');
                  }}
                  className="dialog-btn dialog-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCrime}
                  className="dialog-btn dialog-confirm"
                  style={{
                    background: creatingCrime ? '#a0aec0' : '#48bb78'
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingCrime) {
                      e.currentTarget.style.background = '#38a169';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creatingCrime) {
                      e.currentTarget.style.background = '#48bb78';
                    }
                  }}
                >
                  {creatingCrime ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                      Creating...
                    </>
                  ) : (
                    'Create Crime'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateCase;
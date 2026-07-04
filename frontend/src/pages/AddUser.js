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
  faUserPlus, faUser, faEnvelope, faKey, 
  faBuilding, faShieldAlt, faUserTie, 
  faMicroscope, faGavel, faSpinner, faCheckCircle,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const AddUser = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    role: 'Officer',
    stationId: ''
  });
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'SuperAdmin' && user?.role !== 'StationAdmin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch stations for dropdown
  useEffect(() => {
    if (user?.role === 'SuperAdmin') {
      fetchStations();
    } else if (user?.role === 'StationAdmin') {
      setFormData(prev => ({
        ...prev,
        stationId: user.stationId || ''
      }));
    }
  }, [user]);

  const fetchStations = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/admin/stations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStations(response.data);
    } catch (err) {
      console.error('Failed to load stations');
      showError('Failed to load stations');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setShowTempPassword(false);
    setTempPassword('');
    setEmailSent(false);
    setEmailError('');

    if (!formData.email.trim()) {
      setError('Email is required');
      showError('Email is required');
      return;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      showError('Username is required');
      return;
    }
    if (!formData.role) {
      setError('Role is required');
      showError('Role is required');
      return;
    }

    if (user?.role === 'SuperAdmin' && !formData.stationId) {
      setError('Station is required');
      showError('Station is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      showError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/admin/users',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Check if email was sent
      const emailSentSuccess = response.data.emailSent === true;
      setEmailSent(emailSentSuccess);
      
      if (!emailSentSuccess && response.data.emailError) {
        setEmailError(response.data.emailError);
      }

      // Show temporary password for development
      if (response.data.tempPassword) {
        setTempPassword(response.data.tempPassword);
        setShowTempPassword(true);
      }

      // Success message with email status
      if (emailSentSuccess) {
        showSuccess(`User "${formData.username}" created successfully! Login credentials have been sent to ${formData.email}.`);
      } else {
        showWarning(`User "${formData.username}" created but email could not be sent.`);
        if (emailError) {
          showWarning(`User created but email failed: ${emailError}`);
        }
      }

      // Reset form
      if (user?.role === 'SuperAdmin') {
        setFormData({
          email: '',
          username: '',
          role: 'Officer',
          stationId: ''
        });
      } else {
        setFormData({
          email: '',
          username: '',
          role: 'Officer',
          stationId: user.stationId || ''
        });
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
      showError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'StationAdmin': return <FontAwesomeIcon icon={faUserTie} />;
      case 'Officer': return <FontAwesomeIcon icon={faGavel} />;
      case 'Prosecutor': return <FontAwesomeIcon icon={faShieldAlt} />;
      case 'Analyst': return <FontAwesomeIcon icon={faMicroscope} />;
      default: return <FontAwesomeIcon icon={faUser} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Add New User"
          subtitle="Create a new user account. The system will generate a password and send it to the user's email."
          icon={faUserPlus}
        />

        <div className="upload-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          {/* Email Status Indicator */}
          {message && (
            <div style={{
              background: emailSent ? '#f0fff4' : '#fffbeb',
              border: emailSent ? '1px solid #c6f6d5' : '1px solid #f6e05e',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FontAwesomeIcon 
                icon={emailSent ? faCheckCircle : faExclamationTriangle} 
                style={{ fontSize: '24px', color: emailSent ? '#48bb78' : '#f59e0b' }}
              />
              <div>
                <strong style={{ color: emailSent ? '#22543d' : '#975a16' }}>
                  {emailSent ? 'Email Sent Successfully' : 'Email Delivery Failed'}
                </strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#4a5568' }}>
                  {emailSent 
                    ? `Login credentials have been sent to ${formData.email || 'the user'}.`
                    : `The user account was created but the email could not be delivered. ${emailError || 'Please check the email configuration.'}`}
                </p>
              </div>
            </div>
          )}

          {showTempPassword && tempPassword && (
            <div style={{
              background: '#fefcbf',
              border: '1px solid #f6e05e',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <strong>
                <FontAwesomeIcon icon={faKey} style={{ marginRight: '8px' }} />
                Temporary Password:
              </strong>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                padding: '10px',
                background: 'white',
                borderRadius: '4px',
                marginTop: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {tempPassword}
              </div>
              <p style={{ fontSize: '13px', color: '#744210', marginTop: '8px' }}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '4px' }} />
                This password is only shown here for development. In production, it will be sent via email only.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="user@example.com"
                required
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
                Login credentials will be sent to this email address.
              </p>
            </div>

            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                required
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
                This will be used to log in to the system.
              </p>
            </div>

            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: 'white'
                }}
              >
                {user?.role === 'SuperAdmin' && (
                  <option value="StationAdmin">Station Admin</option>
                )}
                <option value="Officer">Police Officer</option>
                <option value="Prosecutor">Prosecutor</option>
                <option value="Analyst">Analyst</option>
              </select>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Officer', 'Prosecutor', 'Analyst'].map(role => (
                  <span key={role} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: formData.role === role ? '#4a6fa5' : '#e2e8f0',
                    color: formData.role === role ? 'white' : '#4a5568',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {getRoleIcon(role)}
                    {role}
                  </span>
                ))}
              </div>
            </div>

            {/* Station Selection - Only for SuperAdmin */}
            {user?.role === 'SuperAdmin' && (
              <div className="form-group">
                <label>
                  <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                  Station
                </label>
                <select
                  name="stationId"
                  value={formData.stationId}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    background: 'white'
                  }}
                >
                  <option value="">Select a Station</option>
                  {stations.map((station) => (
                    <option key={station.stationId} value={station.stationId}>
                      {station.name} ({station.stationId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Station ID display for StationAdmin */}
            {user?.role === 'StationAdmin' && (
              <div className="form-group">
                <label>
                  <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                  Station
                </label>
                <input
                  type="text"
                  value={user.stationId || 'N/A'}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    background: '#f7fafc',
                    color: '#4a5568'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                  Users will be automatically assigned to your station.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
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
                  Creating User...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: '8px' }} />
                  Create User
                </>
              )}
            </button>
          </form>

          {/* Email Configuration Information */}
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f7fafc', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4a5568' }}>
              <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: '8px' }} />
              Email Configuration
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddUser;
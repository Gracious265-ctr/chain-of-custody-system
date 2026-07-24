import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faMapMarker, faSpinner, faPlus } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const AddStation = () => {
  const [formData, setFormData] = useState({
    name: '',
    location: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { token, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.role !== 'SuperAdmin') {
      navigate('/');
    }
  }, [user, navigate]);

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

    if (!formData.name.trim()) {
      setError('Station name is required');
      showError('Station name is required');
      return;
    }
    if (!formData.location.trim()) {
      setError('Location is required');
      showError('Location is required');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        'http://localhost:5000/api/admin/stations',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showSuccess(`Station "${formData.name}" created successfully!`);
      setFormData({ name: '', location: '' });
      setTimeout(() => {
        navigate('/stations');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create station');
      showError(err.response?.data?.error || 'Failed to create station');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Create New Police Station"
          subtitle="Create a new police station. Station Admins can be created separately."
          icon={faBuilding}
        />

        <div className="upload-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Station Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Luwinga Police Station"
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
            </div>

            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faMapMarker} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Mzuzu, Luwinga "
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
            </div>

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
                  Creating Station...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Create Station
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            background: '#ebf8ff', 
            borderRadius: '8px',
            border: '1px solid #bee3f8'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#2b6cb0' }}>
              <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '8px' }} />
              About Stations
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStation;


import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBuilding, faMapMarker, faUsers, 
  faCalendar, faSearch, faPlus 
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const StationsList = () => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'SuperAdmin') {
      navigate('/');
      return;
    }
    fetchStations();
  }, [user, navigate]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/admin/stations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStations(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stations');
      showError(err.response?.data?.error || 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredStations = stations.filter(station =>
    station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.stationId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Loading stations..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Police Stations"
          subtitle="Manage all police stations in the system"
          icon={faBuilding}
          actions={
            <button 
              onClick={() => navigate('/add-station')}
              className="btn-primary"
            >
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
              Add Station
            </button>
          }
        />

        {/* Search Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
            <input 
              type="text" 
              placeholder="Search stations by name, location, or ID..." 
              value={searchTerm} 
              onChange={handleSearch}
              style={{ 
                width: '100%', 
                padding: '10px 10px 10px 36px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Station Cards */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filteredStations.length === 0 ? (
            <div className="no-stations" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏛️</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No stations found</h3>
              <p style={{ margin: 0 }}>
                {searchTerm 
                  ? 'No stations match your search criteria.'
                  : 'Create your first police station to get started!'}
              </p>
            </div>
          ) : (
            filteredStations.map((station) => (
              <div key={station.stationId} className="enhanced-card" style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f3460' }}>
                      <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                      {station.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#718096', fontFamily: 'monospace' }}>
                      ID: {station.stationId}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#4a5568' }}>
                  <div>
                    <FontAwesomeIcon icon={faMapMarker} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                    <strong>Location:</strong> 
                    <span style={{ color: '#2d3748' }}> {station.location}</span>
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faUsers} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                    <strong>Admin Address:</strong> 
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#2d3748' }}>
                      {station.adminAddress ? station.adminAddress.substring(0, 10) + '...' : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '8px', color: '#718096' }} />
                    <strong>Created:</strong> 
                    <span style={{ color: '#2d3748' }}> {station.createdAt ? new Date(station.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div style={{ 
                  marginTop: '8px', 
                  borderTop: '1px solid #edf2f7', 
                  paddingTop: '12px',
                  fontSize: '12px',
                  color: '#718096'
                }}>
                  <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '4px' }} />
                  Active Station
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StationsList;


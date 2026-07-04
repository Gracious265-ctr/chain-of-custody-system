import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicroscope, faUser, faCheckCircle, 
  faExclamationTriangle, faSpinner, faPlus,
  faTimes, faSearch
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const AssignAnalyst = () => {
  const [cases, setCases] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUnassignCase, setSelectedUnassignCase] = useState(null);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'SuperAdmin' && user?.role !== 'StationAdmin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      // Fetch cases
      const casesRes = await axios.get('http://localhost:5000/api/cases', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      // Fetch users (filter for analysts)
      const usersRes = await axios.get('http://localhost:5000/api/admin/users', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      let casesData = [];
      if (Array.isArray(casesRes.data)) {
        casesData = casesRes.data;
      } else if (casesRes.data && casesRes.data.data !== undefined) {
        casesData = casesRes.data.data || [];
      }
      
      let usersData = [];
      if (Array.isArray(usersRes.data)) {
        usersData = usersRes.data;
      } else if (usersRes.data && usersRes.data.data !== undefined) {
        usersData = usersRes.data.data || [];
      }
      
      const analystsList = usersData.filter(u => 
        u.role === 'Analyst' && 
        u.isActive === true
      );
      
      if (user?.role === 'StationAdmin') {
        casesData = casesData.filter(c => c.station_id === user.stationId);
      }
      
      setCases(casesData || []);
      setAnalysts(analystsList);
    } catch (error) {
      console.error('Fetch Data Error:', error);
      setError('Failed to load data');
      showError('Failed to load data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!selectedCase || !selectedAnalyst) {
      setError('Please select both a case and an analyst');
      showError('Please select both a case and an analyst');
      setLoading(false);
      return;
    }

    const selectedCaseData = cases.find(c => c.case_id === selectedCase);
    if (selectedCaseData && selectedCaseData.analyst_id) {
      if (!window.confirm(`This case is already assigned to analyst "${selectedCaseData.analyst_id}". Are you sure you want to reassign it?`)) {
        setLoading(false);
        return;
      }
    }

    try {
      await axios.post(
        'http://localhost:5000/api/admin/cases/assign-analyst',
        { caseId: selectedCase, analystId: selectedAnalyst },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showSuccess(`Case "${selectedCaseData?.case_number || selectedCase}" assigned to analyst "${selectedAnalyst}" successfully!`);
      setSelectedCase('');
      setSelectedAnalyst('');
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to assign case');
      showError(error.response?.data?.error || 'Failed to assign case');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = (caseItem) => {
    setSelectedUnassignCase(caseItem);
    setIsDialogOpen(true);
  };

  const confirmUnassign = async () => {
    if (!selectedUnassignCase) return;
    
    setLoading(true);
    try {
      await axios.post(
        'http://localhost:5000/api/admin/cases/unassign-analyst',
        { caseId: selectedUnassignCase.case_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(`Case unassigned from analyst "${selectedUnassignCase.analyst_id}" successfully!`);
      setIsDialogOpen(false);
      setSelectedUnassignCase(null);
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to unassign case');
      showError(error.response?.data?.error || 'Failed to unassign case');
    } finally {
      setLoading(false);
    }
  };

  const assignedCases = cases.filter(c => c.analyst_id);
  const unassignedCases = cases.filter(c => !c.analyst_id);

  if (loading && cases.length === 0) return <LoadingSpinner message="Loading data..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Assign Case to Analyst"
          subtitle="Assign or unassign an investigation case to an analyst for technical review"
          icon={faMicroscope}
        />

        <div className="upload-form" style={{ maxWidth: '700px', margin: '0 auto' }}>
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faMicroscope} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Select Case to Assign
              </label>
              <select 
                value={selectedCase} 
                onChange={(e) => setSelectedCase(e.target.value)} 
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
                <option value="">-- Select a case --</option>
                {unassignedCases.length === 0 ? (
                  <option value="" disabled>No unassigned cases available</option>
                ) : (
                  unassignedCases.map(c => (
                    <option key={c.case_id} value={c.case_id}>
                      {c.case_number} - {c.title} {c.is_closed && ' [CLOSED]'}
                    </option>
                  ))
                )}
              </select>
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                {unassignedCases.length} cases available for assignment
              </p>
            </div>

            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                Select Analyst
              </label>
              <select 
                value={selectedAnalyst} 
                onChange={(e) => setSelectedAnalyst(e.target.value)} 
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
                <option value="">-- Select an analyst --</option>
                {analysts.length === 0 ? (
                  <option value="" disabled>No analysts available</option>
                ) : (
                  analysts.map(a => (
                    <option key={a.username} value={a.username}>
                      {a.username} ({a.stationId || 'No Station'})
                    </option>
                  ))
                )}
              </select>
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                {analysts.length} active analysts available
              </p>
            </div>

            <button type="submit" className="auth-btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                  Assigning...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Assign Analyst
                </>
              )}
            </button>
          </form>

          {/* Current assignments */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#2d3748', marginBottom: '12px' }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '8px', color: '#48bb78' }} />
              Current Analyst Assignments ({assignedCases.length})
            </h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {assignedCases.length === 0 ? (
                <p style={{ color: '#718096', textAlign: 'center', padding: '20px' }}>
                  No cases currently assigned to analysts
                </p>
              ) : (
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Case Number</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Analyst</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedCases.map(c => (
                      <tr key={c.case_id} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{c.case_number}</td>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#0f3460' }}>
                          <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                          {c.analyst_id}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: c.is_closed ? '#fed7d7' : '#c6f6d5',
                            color: c.is_closed ? '#9b2c2c' : '#22543d'
                          }}>
                            {c.is_closed ? '🔒 Closed' : '✅ Active'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button 
                            onClick={() => handleUnassign(c)}
                            className="btn-danger"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            <FontAwesomeIcon icon={faTimes} style={{ marginRight: '4px' }} />
                            Unassign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedUnassignCase(null);
          }}
          onConfirm={confirmUnassign}
          title="Unassign Analyst"
          message={`Are you sure you want to unassign "${selectedUnassignCase?.analyst_id}" from case "${selectedUnassignCase?.case_number}"?`}
          confirmText="Unassign"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </div>
  );
};

export default AssignAnalyst;
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, faPlus, faSearch, faFilter, 
  faCheckCircle, faLock, faUser, faBuilding,
  faCalendar, faFileAlt, faEye, faLockOpen
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const CasesList = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [dialogAction, setDialogAction] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  const { token, user, isAdmin, isOfficer, isProsecutor, isAnalyst } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchCases();
  }, [navigate, token, currentPage, searchTerm, statusFilter]);

  const fetchCases = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', limit);
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await axios.get(`http://localhost:5000/api/cases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let casesData = [];
      
      if (res.data && res.data.data !== undefined) {
        casesData = res.data.data || [];
      } else if (Array.isArray(res.data)) {
        casesData = res.data;
      }
      
      let filteredCases = casesData;
      
      if (searchTerm) {
        filteredCases = filteredCases.filter(c => 
          (c.case_number && c.case_number.toLowerCase().includes(searchTerm)) ||
          (c.title && c.title.toLowerCase().includes(searchTerm)) ||
          (c.crime_name && c.crime_name.toLowerCase().includes(searchTerm))
        );
      }
      
      if (statusFilter !== 'all') {
        filteredCases = filteredCases.filter(c => {
          if (statusFilter === 'active') return !c.is_closed;
          if (statusFilter === 'closed') return c.is_closed;
          return true;
        });
      }
      
      if (user?.role === 'Officer') {
        filteredCases = filteredCases.filter(c => c.created_by === user.username);
      } else if (user?.role === 'Prosecutor') {
        filteredCases = filteredCases.filter(c => c.prosecutor_id === user.username);
      } else if (user?.role === 'Analyst') {
        filteredCases = filteredCases.filter(c => c.analyst_id === user.username);
      }
      
      setCases(filteredCases);
      setTotalItems(filteredCases.length);
      setTotalPages(Math.ceil(filteredCases.length / limit));
    } catch (err) {
      console.error('Fetch Cases Error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.clear();
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Failed to load cases');
        showError(err.response?.data?.error || 'Failed to load cases');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (caseItem) => {
    setSelectedCase(caseItem);
    setDialogAction(caseItem.is_closed ? 'reopen' : 'close');
    setIsDialogOpen(true);
  };

  const confirmStatusToggle = async () => {
    if (!selectedCase) return;
    
    try {
      const caseId = selectedCase.case_id || selectedCase.id;
      await axios.put(`http://localhost:5000/api/admin/cases/${caseId}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const action = selectedCase.is_closed ? 'reopened' : 'closed';
      showSuccess(`Case "${selectedCase.case_number}" ${action} successfully!`);
      setIsDialogOpen(false);
      setSelectedCase(null);
      fetchCases();
    } catch (err) {
      showError('Failed to update case status: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedCases = cases.slice(startIndex, endIndex);

  // Get role icon
  const getRoleIcon = (role) => {
    switch(role) {
      case 'Prosecutor': return <FontAwesomeIcon icon={faUser} style={{ color: '#4a6fa5' }} />;
      case 'Analyst': return <FontAwesomeIcon icon={faUser} style={{ color: '#48bb78' }} />;
      default: return <FontAwesomeIcon icon={faUser} style={{ color: '#718096' }} />;
    }
  };

  if (loading) return <LoadingSpinner message="Loading cases..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Case Records"
          subtitle={`${isAdmin ? 'Admin Oversight' : isProsecutor ? 'Cases Assigned to You' : isAnalyst ? 'Cases Assigned to You' : 'Your Created Cases'} (${totalItems} total)`}
          icon={faFolder}
          actions={
            <div style={{ display: 'flex', gap: '10px' }}>
              {isOfficer && (
                <button 
                  onClick={() => navigate('/create-case')} 
                  className="btn-primary"
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Create Case
                </button>
              )}
              <button
                onClick={() => navigate('/closed-cases')}
                className="btn-secondary"
              >
                <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
                Closed Cases
              </button>
            </div>
          }
        />

        {/* Search & Filter Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
              <input 
                type="text" 
                placeholder="Search by number, title, crime..." 
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
            <select 
              value={statusFilter} 
              onChange={handleStatusFilter}
              style={{ 
                padding: '10px 15px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                fontSize: '14px',
                minWidth: '140px',
                outline: 'none',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="active">✅ Active</option>
              <option value="closed">🔒 Closed</option>
            </select>
          </div>
        </div>

        {/* Card Grid Layout */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {paginatedCases.length === 0 ? (
            <div className="no-cases" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No cases found</h3>
              <p style={{ margin: 0 }}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'No cases match your search criteria.'
                  : isOfficer ? 'Create your first case to get started!' : 'No cases are currently available.'}
              </p>
            </div>
          ) : (
            paginatedCases.map((item) => (
              <div key={item.case_id || item.id || Math.random()} className="enhanced-card" style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Top Row: Case Number & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f3460' }}>
                      {item.case_number || 'N/A'}
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#2d3748', marginTop: '2px' }}>
                      {item.title || 'Untitled'}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    background: item.is_closed ? '#fed7d7' : '#c6f6d5',
                    color: item.is_closed ? '#9b2c2c' : '#22543d'
                  }}>
                    {item.is_closed ? '🔒 Closed' : '✅ Active'}
                  </span>
                </div>

                {/* Details Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#4a5568' }}>
                  <div>
                    <strong>Crime:</strong> 
                    <span style={{ color: '#2d3748', fontWeight: '600' }}>
                      {item.crime_name || item.crime_id || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                      <strong>Created By:</strong> 
                      <span style={{ color: '#2d3748' }}> {item.created_by || 'Unknown'}</span>
                    </div>
                    <div>
                      <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                      <strong>Prosecutor:</strong> 
                      <span style={{ color: '#2d3748' }}> {item.prosecutor_id || 'Unassigned'}</span>
                    </div>
                    <div>
                      <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                      <strong>Analyst:</strong> 
                      <span style={{ color: '#2d3748' }}> {item.analyst_id || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '4px', color: '#718096' }} />
                    <strong>Created:</strong> {formatDate(item.timestamp)}
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#718096', 
                    borderTop: '1px solid #edf2f7', 
                    paddingTop: '12px', 
                    marginTop: '4px' 
                  }}>
                    <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                    {item.description.length > 80 ? item.description.substring(0, 80) + '...' : item.description}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: '8px', borderTop: '1px solid #edf2f7', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  
                  <button
                    onClick={() => navigate(`/evidence?caseId=${item.case_id || item.id}`)}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <FontAwesomeIcon icon={faEye} style={{ marginRight: '6px' }} />
                    View Evidence
                  </button>

                  <button
                    onClick={() => navigate(`/supporting-evidence?caseId=${item.case_id || item.id}`)}
                    className="btn-success"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '6px' }} />
                    Supporting Files
                  </button>

                  {/* Prosecutor: Close with Report Button */}
                  {isProsecutor && !item.is_closed && item.prosecutor_id === user?.username && (
                    <button
                      onClick={() => navigate(`/close-case/${item.case_id}`)}
                      className="btn-danger"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      <FontAwesomeIcon icon={faLock} style={{ marginRight: '6px' }} />
                      Close with Report
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleToggleStatus(item)}
                      className={item.is_closed ? 'btn-success' : 'btn-danger'}
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      {item.is_closed ? 'Reopen Case' : 'Close Case'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} cases
          </div>
          <div className="pagination-controls">
            <button 
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedCase(null);
          }}
          onConfirm={confirmStatusToggle}
          title={dialogAction === 'close' ? 'Close Case' : 'Reopen Case'}
          message={`Are you sure you want to ${dialogAction} case "${selectedCase?.case_number}"?`}
          confirmText={dialogAction === 'close' ? 'Close Case' : 'Reopen Case'}
          cancelText="Cancel"
          variant={dialogAction === 'close' ? 'danger' : 'success'}
        />
      </div>
    </div>
  );
};

export default CasesList;
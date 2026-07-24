import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHistory, faSearch, faFilter, faFile,
  faUser, faCalendar, faClock, faEye,
  faUpload, faCheckCircle, faExclamationTriangle,
  faFileAlt, faArchive, faDownload, faFilePdf,
  faFileCsv, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const limit = 20;

  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const getUsername = (userId) => {
    if (userId === 'SYSTEM') return 'System';
    const found = allUsers.find(u => u.username === userId);
    return found ? found.username : userId.substring(0, 8) + '...';
  };

  const getActionLabel = (action) => {
    const labels = {
      'EVIDENCE_UPLOAD': { label: 'Evidence Upload', icon: faUpload, color: '#48bb78' },
      'EVIDENCE_VIEW': { label: 'Evidence View', icon: faEye, color: '#3b82f6' },
      'COURT_READY': { label: 'Court Ready', icon: faCheckCircle, color: '#8b5cf6' },
      'WEAK_EVIDENCE': { label: 'Weak Evidence', icon: faExclamationTriangle, color: '#f59e0b' },
      'EVIDENCE_CASE_ASSIGN': { label: 'Case Assignment', icon: faFileAlt, color: '#0f3460' },
      'EVIDENCE_ARCHIVED': { label: 'Evidence Archived', icon: faArchive, color: '#e53e3e' },
      'EVIDENCE_RESTORED': { label: 'Evidence Restored', icon: faArchive, color: '#10b981' },
      'EVIDENCE_VERIFIED': { label: 'Evidence Verified', icon: faCheckCircle, color: '#0f3460' },
      'SUPPORTING_EVIDENCE_UPLOAD': { label: 'Supporting Evidence Upload', icon: faFile, color: '#0f3460' },
      'SUPPORTING_EVIDENCE_VIEW': { label: 'Supporting Evidence View', icon: faEye, color: '#4a6fa5' },
      'SUPPORTING_EVIDENCE_VERIFIED': { label: 'Supporting Evidence Verified', icon: faCheckCircle, color: '#4a6fa5' },
      'EVIDENCE_DOWNLOAD': { label: 'Evidence Download', icon: faDownload, color: '#0f3460' },
      'SUPPORTING_EVIDENCE_DOWNLOAD': { label: 'Supporting Evidence Download', icon: faDownload, color: '#4a6fa5' }
    };
    return labels[action] || { label: action, icon: faHistory, color: '#718096' };
  };

  useEffect(() => {
    if (user?.role !== 'SuperAdmin' && user?.role !== 'StationAdmin') {
      navigate('/');
      return;
    }
    fetchLogsAndUsers();
  }, [user, navigate, currentPage, searchTerm, actionFilter, fromDate, toDate]);

  const fetchLogsAndUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', limit);
      if (searchTerm) params.append('search', searchTerm);
      if (actionFilter) params.append('action', actionFilter);

      const [logsRes, usersRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/admin/audit-logs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      let logsData = [];
      if (Array.isArray(logsRes.data)) {
        logsData = logsRes.data;
      } else if (logsRes.data && logsRes.data.data !== undefined) {
        logsData = logsRes.data.data || [];
      }
      
      setLogs(logsData);
      setTotalItems(logsData.length);
      setTotalPages(Math.ceil(logsData.length / limit));
      
      let usersData = [];
      if (usersRes.data && usersRes.data.data !== undefined) {
        usersData = usersRes.data.data || [];
      } else if (Array.isArray(usersRes.data)) {
        usersData = usersRes.data;
      }
      setAllUsers(usersData);
    } catch (err) {
      console.error('Fetch Audit Logs Error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/login');
      } else {
        setError('Failed to load audit logs');
        showError('Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const response = await axios.post(
        'http://localhost:5000/api/admin/audit/export',
        {
          from: fromDate || undefined,
          to: toDate || undefined,
          actionFilter: actionFilter || undefined,
          format: format
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: format === 'pdf' ? 'blob' : 'text'
        }
      );

      if (format === 'pdf') {
        // Download PDF
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showSuccess('Audit trail PDF downloaded successfully!');
      } else if (format === 'csv') {
        // Download CSV
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showSuccess('Audit trail CSV downloaded successfully!');
      }
      
      setShowExportOptions(false);
    } catch (err) {
      console.error('Export Error:', err);
      showError(err.response?.data?.error || 'Failed to export audit trail');
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleActionFilter = (e) => {
    setActionFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleFromDate = (e) => {
    setFromDate(e.target.value);
    setCurrentPage(1);
  };

  const handleToDate = (e) => {
    setToDate(e.target.value);
    setCurrentPage(1);
  };

  const getFilteredLogs = () => {
    let filtered = logs;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        (log.action && log.action.toLowerCase().includes(term)) ||
        (log.notes && log.notes.toLowerCase().includes(term)) ||
        (log.actorId && log.actorId.toLowerCase().includes(term)) ||
        (log.evidenceId && log.evidenceId.toLowerCase().includes(term))
      );
    }
    
    if (actionFilter) {
      filtered = filtered.filter(log => log.action === actionFilter);
    }
    
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter(log => new Date(log.timestamp) >= from);
    }
    
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59);
      filtered = filtered.filter(log => new Date(log.timestamp) <= to);
    }
    
    return filtered;
  };

  const filteredLogs = getFilteredLogs();
  const totalFilteredItems = filteredLogs.length;
  const totalFilteredPages = Math.ceil(totalFilteredItems / limit);
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  if (loading) return <LoadingSpinner message="Loading Blockchain Audit Logs..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Immutable Audit Trail"
          subtitle={`${user?.role === 'SuperAdmin' ? 'All Stations' : `Your Station (${user?.stationId || 'Unknown'})`} (${totalFilteredItems} records)`}
          icon={faHistory}
          actions={
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="btn-primary"
                style={{ background: '#805ad5' }}
              >
                <FontAwesomeIcon icon={faDownload} style={{ marginRight: '8px' }} />
                Export
              </button>
            </div>
          }
        />

        {/* Export Options Dropdown */}
        {showExportOptions && (
          <div style={{
            position: 'absolute',
            right: '40px',
            top: '120px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '16px',
            zIndex: 100,
            minWidth: '250px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#2d3748' }}>Export Options</h4>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Date Range</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="date"
                  value={fromDate}
                  onChange={handleFromDate}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flex: 1
                  }}
                />
                <span style={{ color: '#718096', alignSelf: 'center' }}>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={handleToDate}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flex: 1
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting}
                className="btn-primary"
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faFilePdf} />
                {exporting ? 'Exporting...' : 'Export as PDF'}
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="btn-secondary"
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faFileCsv} />
                {exporting ? 'Exporting...' : 'Export as CSV'}
              </button>
            </div>

            <button
              onClick={() => setShowExportOptions(false)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '6px',
                background: 'none',
                border: 'none',
                color: '#718096',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
              <input 
                type="text" 
                placeholder="Search by action, notes, actor, or evidence ID..." 
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
              value={actionFilter} 
              onChange={handleActionFilter}
              style={{ 
                padding: '10px 15px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                fontSize: '14px',
                minWidth: '180px',
                outline: 'none',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">All Actions</option>
              <option value="EVIDENCE_UPLOAD">📤 Evidence Upload</option>
              <option value="EVIDENCE_VIEW">👁️ Evidence View</option>
              <option value="EVIDENCE_DOWNLOAD">⬇️ Evidence Download</option>
              <option value="COURT_READY">⚖️ Court Ready</option>
              <option value="WEAK_EVIDENCE">⚠️ Weak Evidence</option>
              <option value="EVIDENCE_CASE_ASSIGN">📋 Case Assignment</option>
              <option value="EVIDENCE_ARCHIVED">🗄️ Evidence Archived</option>
              <option value="EVIDENCE_RESTORED">📦 Evidence Restored</option>
              <option value="EVIDENCE_VERIFIED">✅ Evidence Verified</option>
              <option value="SUPPORTING_EVIDENCE_UPLOAD">📄 Supporting Evidence Upload</option>
              <option value="SUPPORTING_EVIDENCE_VIEW">👁️ Supporting Evidence View</option>
              <option value="SUPPORTING_EVIDENCE_DOWNLOAD">⬇️ Supporting Evidence Download</option>
              <option value="SUPPORTING_EVIDENCE_VERIFIED">✅ Supporting Evidence Verified</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="evidence-table-container">
          {paginatedLogs.length === 0 ? (
            <div className="no-logs" style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No logs found</h3>
              <p style={{ margin: 0 }}>
                {searchTerm || actionFilter || fromDate || toDate
                  ? 'No logs match your search criteria.'
                  : user?.role === 'StationAdmin' 
                    ? 'No audit logs are available for your station yet.'
                    : 'No audit logs are currently available.'}
              </p>
            </div>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Action Type</th>
                  <th style={{ width: '45%' }}>Human-Readable Description</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => {
                  const actionInfo = getActionLabel(log.action);
                  return (
                    <tr key={index}>
                      <td>
                        <span className="role-badge" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          background: `${actionInfo.color}20`,
                          color: actionInfo.color
                        }}>
                          <FontAwesomeIcon icon={actionInfo.icon} />
                          {actionInfo.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left', lineHeight: '1.6' }}>
                        <strong>{log.notes}</strong>
                      </td>
                      <td>
                        <span className="role-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FontAwesomeIcon icon={faUser} />
                          {getUsername(log.actorId)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>
                            <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '4px', color: '#718096' }} />
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                          <span style={{ fontSize: '12px', color: '#718096' }}>
                            <FontAwesomeIcon icon={faClock} style={{ marginRight: '4px' }} />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} - {Math.min(endIndex, totalFilteredItems)} of {totalFilteredItems} logs
          </div>
          <div className="pagination-controls">
            <button 
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalFilteredPages) }, (_, i) => {
              let pageNum;
              if (totalFilteredPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalFilteredPages - 2) {
                pageNum = totalFilteredPages - 4 + i;
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
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalFilteredPages))}
              disabled={currentPage === totalFilteredPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;


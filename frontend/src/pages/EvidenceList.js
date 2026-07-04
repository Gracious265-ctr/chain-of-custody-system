import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFile, faPlus, faSearch, faFilter,
  faFileUpload, faEye, faCheckCircle,
  faExclamationTriangle, faClock, faFileAlt,
  faArchive, faTrash, faEdit, faDownload,
  faUser, faFolder, faSpinner, faExternalLinkAlt,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const EvidenceList = () => {
  const [evidence, setEvidence] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [dialogAction, setDialogAction] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState('all');
  const [caseFilter, setCaseFilter] = useState('');
  const limit = 10;

  const { token, logout, isOfficer, isAdmin, isProsecutor, isAnalyst, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const caseIdFilter = queryParams.get('caseId') || '';

  useEffect(() => {
    if (caseIdFilter) {
      setCaseFilter(caseIdFilter);
    }
    fetchData();
  }, [currentPage, searchTerm, statusFilter, viewFilter, caseFilter, caseIdFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const evidenceRes = await axios.get(`http://localhost:5000/api/evidence`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const casesRes = await axios.get('http://localhost:5000/api/cases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let evidenceData = [];
      if (Array.isArray(evidenceRes.data)) {
        evidenceData = evidenceRes.data;
      } else if (evidenceRes.data && evidenceRes.data.data !== undefined) {
        evidenceData = evidenceRes.data.data || [];
      }
      
      let casesData = [];
      if (Array.isArray(casesRes.data)) {
        casesData = casesRes.data;
      } else if (casesRes.data && casesRes.data.data !== undefined) {
        casesData = casesRes.data.data || [];
      }
      
      const caseMap = {};
      casesData.forEach(c => {
        caseMap[c.case_id || c.id] = c;
      });
      
      evidenceData = evidenceData.map(item => {
        const caseObj = caseMap[item.case_id];
        if (caseObj) {
          return {
            ...item,
            case_title: caseObj.title || 'Untitled',
            case_number: caseObj.case_number || 'N/A'
          };
        }
        return {
          ...item,
          case_title: 'No Case Assigned',
          case_number: 'N/A'
        };
      });
      
      let filteredEvidence = evidenceData;
      
      if (caseFilter) {
        filteredEvidence = filteredEvidence.filter(item => item.case_id === caseFilter);
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredEvidence = filteredEvidence.filter(item => 
          (item.file_name && item.file_name.toLowerCase().includes(term)) ||
          (item.description && item.description.toLowerCase().includes(term)) ||
          (item.evidence_id && item.evidence_id.toLowerCase().includes(term)) ||
          (item.uploader_id && item.uploader_id.toLowerCase().includes(term)) ||
          (item.case_title && item.case_title.toLowerCase().includes(term)) ||
          (item.case_number && item.case_number.toLowerCase().includes(term))
        );
      }
      
      if (statusFilter !== 'all') {
        filteredEvidence = filteredEvidence.filter(item => {
          if (statusFilter === 'ready') return item.isCourtReady === true;
          if (statusFilter === 'pending') return item.isCourtReady === false && item.isWeak === false;
          if (statusFilter === 'weak') return item.isWeak === true;
          return true;
        });
      }
      
      if (viewFilter !== 'all') {
        if (viewFilter === 'archived') {
          filteredEvidence = filteredEvidence.filter(item => item.isArchived === true);
        } else {
          filteredEvidence = filteredEvidence.filter(item => !item.isArchived);
          if (viewFilter === 'ready') {
            filteredEvidence = filteredEvidence.filter(item => item.isCourtReady === true);
          } else if (viewFilter === 'weak') {
            filteredEvidence = filteredEvidence.filter(item => item.isWeak === true);
          }
        }
      } else {
        filteredEvidence = filteredEvidence.filter(item => !item.isArchived);
      }
      
      setEvidence(filteredEvidence);
      setTotalItems(filteredEvidence.length);
      setTotalPages(Math.ceil(filteredEvidence.length / limit));
      setCases(casesData);
    } catch (err) {
      console.error('Fetch Data Error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        return;
      }
      setError(err.response?.data?.error || 'Failed to load data');
      showError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCase = async (evidenceId) => {
    try {
      if (!selectedCaseId) {
        showError('Please select a case first.');
        return;
      }
      
      setLoading(true);
      
      const response = await axios.put(`http://localhost:5000/api/evidence/${evidenceId}/assign-case`, 
        { caseId: selectedCaseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.verified) {
        showSuccess('Case assigned successfully! The evidence now belongs to the selected case.');
      } else {
        showWarning('Case assignment completed but verification failed. Please refresh the page.');
      }
      
      setAssigningId(null);
      setSelectedCaseId('');
      fetchData();
    } catch (err) {
      console.error('Assign Case Error:', err);
      showError('Failed to assign case: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = async (id, fileName) => {
    const reason = window.prompt(`Please enter the reason for viewing "${fileName}":`);
    if (reason === null) return;
    if (!reason.trim()) {
      showError('A reason is required to view the file.');
      return;
    }

    try {
      const viewUrl = `http://localhost:5000/api/evidence/${id}/view?token=Bearer ${token}&reason=${encodeURIComponent(reason)}`;
      window.open(viewUrl, '_blank');
    } catch (error) {
      console.error('View error:', error);
      showError('Failed to open file.');
    }
  };

  const handleDownloadFile = async (id, fileName) => {
    const reason = window.prompt(`Please enter the reason for downloading "${fileName}":`);
    if (reason === null) return;
    if (!reason.trim()) {
      showError('A reason is required to download the file.');
      return;
    }

    try {
      const downloadUrl = `http://localhost:5000/api/evidence/${id}/download?token=Bearer ${token}&reason=${encodeURIComponent(reason)}`;
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccess(`Downloading "${fileName}"...`);
    } catch (error) {
      console.error('Download error:', error);
      showError('Failed to download file.');
    }
  };

  const handleMarkCourtReady = async (evidenceId, currentStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/evidence/${evidenceId}/court-ready`, 
        { isCourtReady: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(currentStatus ? 'Evidence unmarked from Court Ready' : 'Evidence marked as Court Ready');
      fetchData();
    } catch (err) {
      console.error('Court Ready Error:', err);
      if (err.response?.data?.error === 'Evidence does not exist') {
        showError('This evidence no longer exists on the blockchain. Please refresh the page.');
      } else {
        showError('Failed to update court ready status: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleMarkWeak = async (evidenceId, currentStatus) => {
    if (currentStatus) {
      try {
        await axios.put(`http://localhost:5000/api/evidence/${evidenceId}/mark-weak`, 
          { isWeak: false },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showSuccess('Evidence unmarked as Weak');
        fetchData();
      } catch (err) {
        console.error('Unmark Weak Error:', err);
        showError('Failed to unmark weak evidence.');
      }
    } else {
      const reason = window.prompt('Please provide the reason why this evidence is weak:');
      if (reason === null) return;
      if (!reason.trim()) {
        showError('A reason is required to mark evidence as weak.');
        return;
      }
      try {
        await axios.put(`http://localhost:5000/api/evidence/${evidenceId}/mark-weak`, 
          { isWeak: true, reason: reason.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showSuccess('Evidence marked as Weak');
        fetchData();
      } catch (err) {
        console.error('Mark Weak Error:', err);
        if (err.response?.data?.error === 'Evidence does not exist') {
          showError('This evidence no longer exists on the blockchain. Please refresh the page.');
        } else {
          showError('Failed to mark evidence as weak: ' + (err.response?.data?.error || err.message));
        }
      }
    }
  };

  const handleArchive = async (evidenceId, fileName, isArchived) => {
    const action = isArchived ? 'restore' : 'archive';
    
    setSelectedEvidence({ id: evidenceId, name: fileName, isArchived });
    setDialogAction(action);
    setIsDialogOpen(true);
  };

  const confirmArchiveAction = async () => {
    if (!selectedEvidence) return;
    
    try {
      await axios.put(
        `http://localhost:5000/api/evidence/${selectedEvidence.id}/archive`,
        { action: dialogAction },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showSuccess(dialogAction === 'archive' ? 'Evidence archived successfully' : 'Evidence restored successfully');
      setIsDialogOpen(false);
      setSelectedEvidence(null);
      fetchData();
    } catch (err) {
      showError('Failed to archive/restore evidence: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleViewFilter = (e) => {
    setViewFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleCaseFilter = (e) => {
    setCaseFilter(e.target.value);
    setCurrentPage(1);
    if (e.target.value) {
      navigate(`/evidence?caseId=${e.target.value}`, { replace: true });
    } else {
      navigate(`/evidence`, { replace: true });
    }
  };

  const truncateId = (id) => {
    if (!id) return 'N/A';
    if (id.length <= 8) return id;
    return id.substring(0, 8) + '...';
  };

  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedEvidence = evidence.slice(startIndex, endIndex);

  if (loading) return <LoadingSpinner message="Loading evidence..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Evidence Records"
          subtitle={`${isAdmin ? 'Admin Oversight' : isProsecutor ? 'Evidence for your Cases' : isAnalyst ? 'Evidence for your Cases' : 'Your Evidence'} (${totalItems} total)`}
          icon={faFile}
          actions={
            isOfficer && (
              <button 
                onClick={() => navigate('/upload')}
                className="btn-primary"
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                Upload Evidence
              </button>
            )
          }
        />

        {/* Search & Filter Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
              <input 
                type="text" 
                placeholder="Search by filename, description, ID..." 
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
              value={caseFilter} 
              onChange={handleCaseFilter}
              style={{ 
                padding: '10px 15px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                fontSize: '14px',
                minWidth: '160px',
                outline: 'none',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">All Cases</option>
              {cases.map(c => (
                <option key={c.case_id || c.id} value={c.case_id || c.id}>
                  {c.case_number} - {c.title}
                </option>
              ))}
            </select>

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
              <option value="ready">⚖️ Court Ready</option>
              <option value="pending">📄 Pending Review</option>
              <option value="weak">⚠️ Weak Evidence</option>
            </select>

            <select 
              value={viewFilter} 
              onChange={handleViewFilter}
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
              <option value="all">All Evidence</option>
              <option value="ready">📋 Court Ready List</option>
              <option value="weak">⚠️ Weak Evidence List</option>
              <option value="archived">🗄️ Archived Evidence</option>
            </select>
          </div>
        </div>

        {/* Card Grid Layout */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {paginatedEvidence.length === 0 ? (
            <div className="no-evidence" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No evidence found</h3>
              <p style={{ margin: 0 }}>
                {isAnalyst ? (
                  'You are not assigned to any cases yet. Contact an administrator to be assigned to a case.'
                ) : (
                  searchTerm || statusFilter !== 'all' || viewFilter !== 'all' || caseFilter
                    ? 'No evidence matches your search criteria.'
                    : isOfficer ? 'Upload your first evidence file to get started!' : 'No evidence is currently available.'
                )}
              </p>
            </div>
          ) : (
            paginatedEvidence.map((item) => (
              <div key={item.evidence_id || Math.random()} className="enhanced-card" style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Top Row: File Name & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f3460' }}>
                      {item.file_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', fontFamily: 'monospace' }}>
                      ID: {truncateId(item.evidence_id)}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    background: item.isWeak ? '#fed7d7' :
                              item.isCourtReady ? '#c6f6d5' : '#fefcbf',
                    color: item.isWeak ? '#9b2c2c' :
                           item.isCourtReady ? '#22543d' : '#975a16'
                  }}>
                    {item.isWeak ? '⚠️ Weak Evidence' : 
                     item.isCourtReady ? '⚖️ Court Ready' : '📄 Pending Review'}
                  </span>
                </div>

                {/* Description Section */}
                {item.description && (
                  <div style={{ 
                    background: '#f7fafc', 
                    padding: '12px', 
                    borderRadius: '6px',
                    borderLeft: '3px solid #0f3460',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>
                      <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px' }} />
                      Description:
                    </div>
                    <div style={{ fontSize: '14px', color: '#2d3748', marginTop: '4px' }}>{item.description}</div>
                  </div>
                )}

                {/* Details Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#4a5568' }}>
                  <div>
                    <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                    <strong>Uploader:</strong> 
                    <span style={{ color: '#2d3748' }}>{item.uploader_id || 'Unknown'}</span>
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faFolder} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                    <strong>Case:</strong> 
                    <span style={{ color: '#2d3748', fontWeight: '600' }}>
                      {item.case_title || 'No Case Assigned'}
                    </span>
                    {item.case_number && item.case_number !== 'N/A' && (
                      <span style={{ color: '#718096', marginLeft: '8px' }}>
                        ({item.case_number})
                      </span>
                    )}
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faClock} style={{ marginRight: '4px', color: '#718096' }} />
                    <strong>Uploaded:</strong> {formatDate(item.timestamp)}
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: '4px', color: '#718096' }} />
                    <strong>Size:</strong> {formatFileSize(item.size)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: '8px', borderTop: '1px solid #edf2f7', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  
                  {/* Prosecutor Actions */}
                  {isProsecutor && (
                    <>
                      <button
                        onClick={() => handleMarkCourtReady(item.evidence_id, item.isCourtReady)}
                        className={item.isCourtReady ? 'btn-success' : 'btn-secondary'}
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                      >
                        {item.isCourtReady ? 'Court Ready' : 'Mark Ready'}
                      </button>
                      <button
                        onClick={() => handleMarkWeak(item.evidence_id, item.isWeak)}
                        className={item.isWeak ? 'btn-secondary' : 'btn-danger'}
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                      >
                        {item.isWeak ? 'Unmark Weak' : 'Mark Weak'}
                      </button>
                    </>
                  )}

                  {/* Officer: Assign/Edit Case */}
                  {isOfficer && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {assigningId === item.evidence_id ? (
                        <>
                          <select
                            value={selectedCaseId}
                            onChange={(e) => setSelectedCaseId(e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px',
                              background: 'white',
                              minWidth: '150px'
                            }}
                          >
                            <option value="">Select Case</option>
                            {cases.map(c => (
                              <option key={c.case_id || c.id} value={c.case_id || c.id}>
                                {c.case_number} - {c.title}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssignCase(item.evidence_id)}
                            className="btn-success"
                            style={{ padding: '6px 16px', fontSize: '13px' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setAssigningId(null);
                              setSelectedCaseId('');
                            }}
                            className="btn-secondary"
                            style={{ padding: '6px 16px', fontSize: '13px' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setAssigningId(item.evidence_id);
                            setSelectedCaseId(item.case_id || '');
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 16px', fontSize: '13px' }}
                        >
                          Assign Case
                        </button>
                      )}
                    </div>
                  )}

                  {/* Admin Archive/Unarchive Button */}
                  {isAdmin && (
                    <button
                      onClick={() => handleArchive(item.evidence_id, item.file_name, item.isArchived)}
                      className={item.isArchived ? 'btn-success' : 'btn-danger'}
                      style={{ padding: '6px 16px', fontSize: '13px' }}
                    >
                      <FontAwesomeIcon icon={item.isArchived ? faArchive : faTrash} style={{ marginRight: '6px' }} />
                      {item.isArchived ? 'Restore' : 'Archive'}
                    </button>
                  )}

                  {/* Verify Button */}
                  <button
                    onClick={() => navigate(`/verify/${item.evidence_id}`)}
                    className="btn-primary"
                    style={{ 
                      padding: '6px 16px', 
                      fontSize: '13px',
                      background: '#805ad5'
                    }}
                  >
                    <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '6px' }} />
                    Verify
                  </button>

                  {/* Report Button */}
                  <button
                    onClick={() => navigate(`/report/${item.evidence_id}`)}
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '6px' }} />
                    Report
                  </button>

                  {/* View Button */}
                  <button
                    onClick={() => handleViewFile(item.evidence_id, item.file_name)}
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '13px', background: '#3182ce' }}
                  >
                    <FontAwesomeIcon icon={faEye} style={{ marginRight: '6px' }} />
                    View
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={() => handleDownloadFile(item.evidence_id, item.file_name)}
                    className="btn-success"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: '6px' }} />
                    Download
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} evidence
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
            setSelectedEvidence(null);
          }}
          onConfirm={confirmArchiveAction}
          title={dialogAction === 'archive' ? 'Archive Evidence' : 'Restore Evidence'}
          message={`Are you sure you want to ${dialogAction} "${selectedEvidence?.name}"?`}
          confirmText={dialogAction === 'archive' ? 'Archive' : 'Restore'}
          cancelText="Cancel"
          variant={dialogAction === 'archive' ? 'danger' : 'success'}
        />
      </div>
    </div>
  );
};

export default EvidenceList;
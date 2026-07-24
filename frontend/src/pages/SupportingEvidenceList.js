import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, faPlus, faSearch, faEye,
  faDownload, faUser, faFolder, faClock,
  faExternalLinkAlt, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const SupportingEvidenceList = () => {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cases, setCases] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const limit = 10;

  const { token, logout, isAnalyst, isAdmin, isOfficer, isProsecutor, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const caseIdFilter = queryParams.get('caseId') || '';

  useEffect(() => {
    if (caseIdFilter) {
      setCaseFilter(caseIdFilter);
    }
    fetchData();
  }, [currentPage, searchTerm, caseFilter, caseIdFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch supporting evidence
      const evidenceRes = await axios.get(`http://localhost:5000/api/supporting-evidence`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch cases for case name lookup
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
      
      // Build case lookup map
      const caseMap = {};
      casesData.forEach(c => {
        caseMap[c.case_id || c.id] = c;
      });
      
      // Enrich evidence with case data
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
      
      // Apply client-side search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        evidenceData = evidenceData.filter(item => 
          (item.file_name && item.file_name.toLowerCase().includes(term)) ||
          (item.description && item.description.toLowerCase().includes(term)) ||
          (item.uploader_id && item.uploader_id.toLowerCase().includes(term)) ||
          (item.case_title && item.case_title.toLowerCase().includes(term)) ||
          (item.case_number && item.case_number.toLowerCase().includes(term))
        );
      }
      
      // Apply case filter
      if (caseFilter) {
        evidenceData = evidenceData.filter(item => item.case_id === caseFilter);
      }
      
      setEvidence(evidenceData);
      setTotalItems(evidenceData.length);
      setTotalPages(Math.ceil(evidenceData.length / limit));
      setCases(casesData);
    } catch (err) {
      console.error('Fetch Supporting Evidence Error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        return;
      }
      setError(err.response?.data?.error || 'Failed to load supporting evidence');
      showError(err.response?.data?.error || 'Failed to load supporting evidence');
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
      const viewUrl = `http://localhost:5000/api/supporting-evidence/${id}/view?token=Bearer ${token}&reason=${encodeURIComponent(reason)}`;
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
      const downloadUrl = `http://localhost:5000/api/supporting-evidence/${id}/download?token=Bearer ${token}&reason=${encodeURIComponent(reason)}`;
      
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

  const handleCaseFilter = (e) => {
    setCaseFilter(e.target.value);
    setCurrentPage(1);
    if (e.target.value) {
      navigate(`/supporting-evidence?caseId=${e.target.value}`, { replace: true });
    } else {
      navigate(`/supporting-evidence`, { replace: true });
    }
  };

  // Client-side pagination
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedEvidence = evidence.slice(startIndex, endIndex);

  if (loading) return <LoadingSpinner message="Loading supporting evidence..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Supporting Evidence"
          subtitle={`${isAdmin ? 'Admin Oversight' : isOfficer ? 'Cases you created' : isProsecutor ? 'Cases assigned to you' : 'Your assigned cases'} (${totalItems} total)`}
          icon={faFileAlt}
          actions={
            isAnalyst && (
              <button 
                onClick={() => navigate('/upload-supporting')}
                className="btn-primary"
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                Upload Supporting Evidence
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
                placeholder="Search by filename, description, uploader, or case..." 
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
          </div>
        </div>

        {/* Card Grid Layout */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {paginatedEvidence.length === 0 ? (
            <div className="no-evidence" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No supporting evidence found</h3>
              <p style={{ margin: 0 }}>
                {searchTerm || caseFilter 
                  ? 'No supporting evidence matches your search criteria.'
                  : isAdmin ? 'No supporting evidence has been uploaded yet.' :
                    isOfficer ? 'No supporting evidence for cases you created.' :
                    isProsecutor ? 'No supporting evidence for cases assigned to you.' :
                    'No supporting evidence available.'}
              </p>
            </div>
          ) : (
            paginatedEvidence.map((item) => (
              <div key={item.supporting_id || Math.random()} className="enhanced-card" style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Top Row: File Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#2d3748' }}>
                      {item.file_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', fontFamily: 'monospace' }}>
                      ID: {item.supporting_id ? item.supporting_id.substring(0, 8) + '...' : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Description Section with View More */}
                {item.description && (
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '6px',
                    borderLeft: '3px solid #4a6fa5',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>
                      <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px' }} />
                      Description:
                    </div>
                    <div style={{ fontSize: '14px', color: '#2d3748', marginTop: '4px' }}>
                      <span className="description-text">
                        {item.description && item.description.length > 80 ? (
                          <>
                            {item.description.substring(0, 80)}...
                            <button 
                              className="more-btn"
                              onClick={() => {
                                window.alert(item.description);
                              }}
                            >
                              View More
                            </button>
                          </>
                        ) : (
                          item.description
                        )}
                      </span>
                    </div>
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
                      {item.case_title || item.case_number || item.case_id || 'N/A'}
                    </span>
                    {item.case_number && item.case_number !== item.case_id && (
                      <span style={{ color: '#718096', marginLeft: '8px' }}>
                        ({item.case_number})
                      </span>
                    )}
                  </div>
                  {item.evidence_id && (
                    <div>
                      <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                      <strong>Linked Evidence:</strong> 
                      <span style={{ color: '#2d3748' }}>{item.evidence_id.substring(0, 8)}...</span>
                    </div>
                  )}
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
                <div className="card-actions">
                  {/* View Button */}
                  <button
                    onClick={() => handleViewFile(item.supporting_id, item.file_name)}
                    className="btn-primary"
                  >
                    <FontAwesomeIcon icon={faEye} style={{ marginRight: '6px' }} />
                    View
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={() => handleDownloadFile(item.supporting_id, item.file_name)}
                    className="btn-success"
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
            Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} supporting files
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
      </div>
    </div>
  );
};

export default SupportingEvidenceList;


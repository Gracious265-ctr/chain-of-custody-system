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
  faShieldAlt, faChartBar, faList, faThLarge,
  faSort, faSortUp, faSortDown, faTimes,
  faChevronLeft, faChevronRight, faCalendar,
  faFilePdf, faFileImage, faFileVideo,
  faFileAudio, faFileArchive, faFileWord,
  faFileExcel, faInfoCircle, faQrcode,
  faChevronDown, faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
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
  
  // Advanced state
  const [filteredEvidence, setFilteredEvidence] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState('all');
  const [caseFilter, setCaseFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'table'
  const [showFilters, setShowFilters] = useState(false);
  
  // Description expand state
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalItems, setTotalItems] = useState(0);

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
  }, [currentPage, searchTerm, statusFilter, viewFilter, caseFilter, uploaderFilter, fileTypeFilter, dateRange, sortConfig]);

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
      
      setEvidence(evidenceData);
      setCases(casesData);
      applyFiltersAndSort(evidenceData);
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

  const getFileTypeCategory = (mimeType) => {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'spreadsheet';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive';
    return 'other';
  };

  const getFileTypeIcon = (mimeType) => {
    const category = getFileTypeCategory(mimeType);
    switch(category) {
      case 'image': return faFileImage;
      case 'video': return faFileVideo;
      case 'audio': return faFileAudio;
      case 'pdf': return faFilePdf;
      case 'document': return faFileWord;
      case 'spreadsheet': return faFileExcel;
      case 'archive': return faFileArchive;
      default: return faFile;
    }
  };

  const getFileTypeColor = (mimeType) => {
    const category = getFileTypeCategory(mimeType);
    switch(category) {
      case 'image': return '#48bb78';
      case 'video': return '#e53e3e';
      case 'audio': return '#9f7aea';
      case 'pdf': return '#e53e3e';
      case 'document': return '#3182ce';
      case 'spreadsheet': return '#48bb78';
      case 'archive': return '#ed8936';
      default: return '#718096';
    }
  };

  const applyFiltersAndSort = (data = evidence) => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.file_name && item.file_name.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.evidence_id && item.evidence_id.toLowerCase().includes(term)) ||
        (item.uploader_id && item.uploader_id.toLowerCase().includes(term)) ||
        (item.case_title && item.case_title.toLowerCase().includes(term)) ||
        (item.case_number && item.case_number.toLowerCase().includes(term))
      );
    }

    // Case filter
    if (caseFilter) {
      filtered = filtered.filter(item => item.case_id === caseFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (statusFilter === 'ready') return item.isCourtReady === true && !item.isArchived;
        if (statusFilter === 'pending') return item.isCourtReady === false && item.isWeak === false && !item.isArchived;
        if (statusFilter === 'weak') return item.isWeak === true && !item.isArchived;
        if (statusFilter === 'archived') return item.isArchived === true;
        return true;
      });
    }

    // View filter
    if (viewFilter !== 'all') {
      if (viewFilter === 'archived') {
        filtered = filtered.filter(item => item.isArchived === true);
      } else {
        filtered = filtered.filter(item => !item.isArchived);
        if (viewFilter === 'ready') {
          filtered = filtered.filter(item => item.isCourtReady === true);
        } else if (viewFilter === 'weak') {
          filtered = filtered.filter(item => item.isWeak === true);
        }
      }
    } else {
      filtered = filtered.filter(item => !item.isArchived);
    }

    // Uploader filter
    if (uploaderFilter !== 'all') {
      filtered = filtered.filter(item => item.uploader_id === uploaderFilter);
    }

    // File type filter
    if (fileTypeFilter !== 'all') {
      filtered = filtered.filter(item => getFileTypeCategory(item.fileType) === fileTypeFilter);
    }

    // Date range filter
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      filtered = filtered.filter(item => new Date(item.timestamp) >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(item => new Date(item.timestamp) <= end);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle special cases
      if (sortConfig.key === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      if (sortConfig.key === 'size') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredEvidence(filtered);
    setTotalItems(filtered.length);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
      showError('Failed to update court ready status: ' + (err.response?.data?.error || err.message));
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
        showError('Failed to mark evidence as weak: ' + (err.response?.data?.error || err.message));
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

  const truncateId = (id) => {
    if (!id) return 'N/A';
    if (id.length <= 8) return id;
    return id.substring(0, 8) + '...';
  };

  const getUploaders = () => {
    const uploaders = new Set();
    evidence.forEach(item => {
      if (item.uploader_id) uploaders.add(item.uploader_id);
    });
    return Array.from(uploaders);
  };

  const getFileTypes = () => {
    const types = new Set();
    evidence.forEach(item => {
      const type = getFileTypeCategory(item.fileType);
      if (type !== 'other') types.add(type);
    });
    return Array.from(types);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setViewFilter('all');
    setCaseFilter('');
    setUploaderFilter('all');
    setFileTypeFilter('all');
    setDateRange({ start: '', end: '' });
    setSortConfig({ key: 'timestamp', direction: 'desc' });
  };

  // Toggle description expansion
  const toggleDescription = (evidenceId) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [evidenceId]: !prev[evidenceId]
    }));
  };

  // Render description with show more/less
  const renderDescription = (description, evidenceId) => {
    if (!description) return null;
    
    const isExpanded = expandedDescriptions[evidenceId];
    const wordLimit = 20;
    const words = description.split(' ');
    const shouldTruncate = words.length > wordLimit;
    
    if (!shouldTruncate) {
      return (
        <div style={{ 
          background: '#f7fafc', 
          padding: '12px', 
          borderRadius: '6px',
          borderLeft: '3px solid #0f3460'
        }}>
          <div style={{ fontSize: '14px', color: '#2d3748' }}>{description}</div>
        </div>
      );
    }

    const truncatedText = words.slice(0, wordLimit).join(' ') + '...';
    const displayText = isExpanded ? description : truncatedText;

    return (
      <div style={{ 
        background: '#f7fafc', 
        padding: '12px', 
        borderRadius: '6px',
        borderLeft: '3px solid #0f3460'
      }}>
        <div style={{ fontSize: '14px', color: '#2d3748' }}>{displayText}</div>
        <button
          onClick={() => toggleDescription(evidenceId)}
          style={{
            marginTop: '8px',
            background: 'none',
            border: 'none',
            color: '#4a6fa5',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#0f3460'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#4a6fa5'}
        >
          <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} size="xs" />
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      </div>
    );
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvidence = filteredEvidence.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredEvidence.length / itemsPerPage);

  // Render Grid View
  const renderGridView = () => {
    return (
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {paginatedEvidence.map((item) => (
          <motion.div
            key={item.evidence_id || Math.random()}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="enhanced-card"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {/* Top Row: File Name & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f3460', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FontAwesomeIcon 
                    icon={getFileTypeIcon(item.fileType)} 
                    style={{ color: getFileTypeColor(item.fileType) }} 
                  />
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
                {item.isWeak ? '⚠️ Weak' : 
                 item.isCourtReady ? '⚖️ Ready' : '📄 Pending'}
              </span>
            </div>

            {/* Description Section with Show More/Less */}
            {renderDescription(item.description, item.evidence_id)}

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
          </motion.div>
        ))}
      </div>
    );
  };

  // Render List View
  const renderListView = () => {
    return (
      <div className="evidence-table-container">
        <table className="evidence-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>File Name</th>
              <th>Type</th>
              <th>Case</th>
              <th>Uploader</th>
              <th>Status</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvidence.map((item, index) => (
              <tr key={item.evidence_id || Math.random()}>
                <td style={{ textAlign: 'center' }}>{startIndex + index + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FontAwesomeIcon 
                      icon={getFileTypeIcon(item.fileType)} 
                      style={{ color: getFileTypeColor(item.fileType) }} 
                    />
                    <strong>{item.file_name || 'Unknown'}</strong>
                    <div style={{ fontSize: '11px', color: '#718096', fontFamily: 'monospace' }}>
                      {truncateId(item.evidence_id)}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="role-badge" style={{ 
                    background: `${getFileTypeColor(item.fileType)}20`,
                    color: getFileTypeColor(item.fileType)
                  }}>
                    {getFileTypeCategory(item.fileType).toUpperCase()}
                  </span>
                </td>
                <td>{item.case_title || 'N/A'}</td>
                <td>{item.uploader_id || 'N/A'}</td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: item.isWeak ? '#fed7d7' :
                              item.isCourtReady ? '#c6f6d5' : '#fefcbf',
                    color: item.isWeak ? '#9b2c2c' :
                           item.isCourtReady ? '#22543d' : '#975a16'
                  }}>
                    {item.isWeak ? '⚠️ Weak' : 
                     item.isCourtReady ? '⚖️ Ready' : '📄 Pending'}
                  </span>
                </td>
                <td>{formatFileSize(item.size)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleViewFile(item.evidence_id, item.file_name)}
                      className="btn-primary"
                      style={{ padding: '4px 10px', fontSize: '12px', background: '#3182ce' }}
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button
                      onClick={() => handleDownloadFile(item.evidence_id, item.file_name)}
                      className="btn-success"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                    <button
                      onClick={() => navigate(`/report/${item.evidence_id}`)}
                      className="btn-primary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      <FontAwesomeIcon icon={faFileAlt} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="btn-secondary"
                style={{ padding: '10px 14px' }}
              >
                <FontAwesomeIcon icon={viewMode === 'grid' ? faList : faThLarge} />
              </button>
              <button
                onClick={toggleFilters}
                className="btn-secondary"
                style={{ padding: '10px 14px' }}
              >
                <FontAwesomeIcon icon={faFilter} />
                {showFilters ? 'Hide Filters' : 'Filters'}
              </button>
              {isOfficer && (
                <button 
                  onClick={() => navigate('/upload')}
                  className="btn-primary"
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Upload Evidence
                </button>
              )}
            </div>
          }
        />

        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="enhanced-card"
              style={{ marginBottom: '24px', padding: '16px 20px', overflow: 'hidden' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
                  <input 
                    type="text" 
                    placeholder="Search files, descriptions, IDs..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
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

                {/* Status Filter */}
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ 
                    padding: '10px 15px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="ready">⚖️ Court Ready</option>
                  <option value="pending">📄 Pending Review</option>
                  <option value="weak">⚠️ Weak Evidence</option>
                  <option value="archived">🗄️ Archived</option>
                </select>

                {/* Case Filter */}
                <select 
                  value={caseFilter} 
                  onChange={(e) => setCaseFilter(e.target.value)}
                  style={{ 
                    padding: '10px 15px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    fontSize: '14px',
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

                {/* Uploader Filter */}
                <select 
                  value={uploaderFilter} 
                  onChange={(e) => setUploaderFilter(e.target.value)}
                  style={{ 
                    padding: '10px 15px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Uploaders</option>
                  {getUploaders().map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>

                {/* File Type Filter */}
                <select 
                  value={fileTypeFilter} 
                  onChange={(e) => setFileTypeFilter(e.target.value)}
                  style={{ 
                    padding: '10px 15px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All File Types</option>
                  <option value="image">🖼️ Images</option>
                  <option value="video">🎬 Videos</option>
                  <option value="audio">🎵 Audio</option>
                  <option value="pdf">📄 PDF</option>
                  <option value="document">📝 Documents</option>
                  <option value="spreadsheet">📊 Spreadsheets</option>
                  <option value="archive">📦 Archives</option>
                </select>

                {/* Date Range */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <FontAwesomeIcon icon={faCalendar} style={{ color: '#a0aec0' }} />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      flex: 1
                    }}
                  />
                  <span style={{ color: '#718096' }}>to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      flex: 1
                    }}
                  />
                </div>

                {/* Sort */}
                <select 
                  value={`${sortConfig.key}-${sortConfig.direction}`}
                  onChange={(e) => {
                    const [key, direction] = e.target.value.split('-');
                    setSortConfig({ key, direction });
                  }}
                  style={{ 
                    padding: '10px 15px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="timestamp-desc">Newest First</option>
                  <option value="timestamp-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="size-desc">Largest First</option>
                  <option value="size-asc">Smallest First</option>
                </select>

                {/* Reset Filters */}
                <button
                  onClick={resetFilters}
                  className="btn-secondary"
                  style={{ padding: '10px 15px' }}
                >
                  <FontAwesomeIcon icon={faTimes} style={{ marginRight: '8px' }} />
                  Reset Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Evidence Display */}
        {filteredEvidence.length === 0 ? (
          <div className="no-evidence" style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            color: '#718096',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No evidence found</h3>
            <p style={{ margin: 0 }}>
              {isAnalyst ? (
                'You are not assigned to any cases yet. Contact an administrator to be assigned to a case.'
              ) : (
                searchTerm || statusFilter !== 'all' || viewFilter !== 'all' || caseFilter || uploaderFilter !== 'all' || fileTypeFilter !== 'all' || dateRange.start || dateRange.end
                  ? 'No evidence matches your search criteria.'
                  : isOfficer ? 'Upload your first evidence file to get started!' : 'No evidence is currently available.'
              )}
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? renderGridView() : renderListView()}
            
            {/* Items per page selector */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#718096' }}>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  background: 'white'
                }}
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          </>
        )}

        {/* Pagination */}
        {filteredEvidence.length > 0 && (
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
        )}

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


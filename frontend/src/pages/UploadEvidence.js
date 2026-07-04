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
  faFileUpload, faFile, faInfoCircle, 
  faTimes, faCheckCircle, faExclamationCircle,
  faSpinner  // ✅ Added missing import
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const UploadEvidence = () => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/cases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCases(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load cases');
      showError('Failed to load cases');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const validateFile = (file) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/mpeg', 'video/quicktime',
      'audio/mpeg', 'audio/mp4', 'audio/wav',
      'text/plain', 'text/csv', 'application/json',
      'application/zip', 'application/x-rar-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      showError(`File type "${file.type}" not allowed. Please upload a supported file type.`);
      return false;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      showError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      showError('Please select a file');
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    if (!description.trim()) {
      showError('Please provide a description for this evidence');
      return;
    }

    if (description.trim().length < 5) {
      showError('Description must be at least 5 characters');
      return;
    }

    if (description.trim().length > 1000) {
      showError('Description cannot exceed 1000 characters');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('caseId', selectedCase);

    try {
      const response = await axios.post('http://localhost:5000/api/evidence/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      showSuccess(`✅ File "${file.name}" uploaded successfully!`);
      setTimeout(() => {
        navigate('/evidence');
      }, 2000);
      
    } catch (err) {
      console.error('Upload Error:', err);
      showError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Upload Evidence"
          subtitle="Upload evidence files to IPFS and record on the blockchain"
          icon={faFileUpload}
        />

        <div className="upload-form">
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Drag & Drop File Upload */}
            <div className="form-group">
              <label>Select File</label>
              <div
                style={{
                  border: `2px dashed ${dragActive ? '#0f3460' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragActive ? '#f7fafc' : 'white',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <FontAwesomeIcon icon={faFile} size="2x" style={{ color: '#0f3460' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>{file.name}</div>
                      <div style={{ fontSize: '13px', color: '#718096' }}>
                        {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      style={{
                        background: '#fed7d7',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c53030'
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <FontAwesomeIcon icon={faFileUpload} size="3x" style={{ color: '#a0aec0', marginBottom: '12px' }} />
                    <p style={{ color: '#4a5568', margin: 0 }}>
                      <strong>Click to upload</strong> or drag and drop
                    </p>
                    <p style={{ color: '#718096', fontSize: '13px', marginTop: '4px' }}>
                      Supported: Images, PDFs, Documents, Videos, Audio (Max 50MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#4a5568' }}>
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{
                  height: '6px',
                  background: '#e2e8f0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: '#0f3460',
                    borderRadius: '3px',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label>Evidence Description (Required)</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Describe the evidence (e.g., 'CCTV footage showing suspect entering the building')"
                rows="4"
                required
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
              <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Min 5 characters</span>
                <span>{description.length} / 1000</span>
              </div>
            </div>

            <div className="form-group">
              <label>Assign to Case (Optional)</label>
              <select 
                value={selectedCase} 
                onChange={(e) => setSelectedCase(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: 'white'
                }}
              >
                <option value="">No Case</option>
                {cases.map(c => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_number} - {c.title}
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={uploading} 
              className="auth-btn"
              style={{
                width: '100%',
                padding: '14px',
                background: uploading ? '#a0aec0' : '#0f3460',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >
              {uploading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFileUpload} style={{ marginRight: '8px' }} />
                  Upload Evidence
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
              <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: '8px' }} />
              About Evidence Upload
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadEvidence;
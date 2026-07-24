import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFile, faUpload, faCheckCircle, faExclamationTriangle,
  faArrowLeft, faSpinner, faFileAlt, faLock,
  faInfoCircle  // ✅ Added missing import
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const CloseCaseWithReport = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  const [caseData, setCaseData] = useState(null);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchCaseDetails();
  }, [id, token]);

  const fetchCaseDetails = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/cases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const cases = response.data.data || response.data;
      const foundCase = cases.find(c => c.case_id === id);
      
      if (!foundCase) {
        setError('Case not found');
        showError('Case not found');
        return;
      }
      
      // Check if user is assigned prosecutor
      if (foundCase.prosecutor_id !== user?.username) {
        setError('You are not assigned as the prosecutor for this case');
        showError('You are not assigned as the prosecutor for this case');
        return;
      }
      
      // Check if case is already closed
      if (foundCase.is_closed) {
        setError('This case is already closed');
        showError('This case is already closed');
        return;
      }
      
      setCaseData(foundCase);
    } catch (err) {
      console.error('Fetch Case Error:', err);
      setError('Failed to load case details');
      showError('Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a closure report file');
      showError('Please select a closure report file');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a case closure description');
      showError('Please provide a case closure description');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, Word document, or text file');
      showError('Please upload a PDF, Word document, or text file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      showError('File size exceeds 10MB limit');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);

    try {
      const response = await axios.post(
        `http://localhost:5000/api/prosecutor/cases/${id}/close-with-report`,
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`, 
            'Content-Type': 'multipart/form-data' 
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      showSuccess(`✅ Case "${caseData?.case_number}" closed successfully with report!`);
      setTimeout(() => {
        navigate('/cases');
      }, 3000);
    } catch (err) {
      console.error('Case Closure Error:', err);
      const errorMsg = err.response?.data?.error || 'Failed to close case';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading case details..." fullPage />;
  
  if (error) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <div className="error-message" style={{ padding: '30px', textAlign: 'center' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} size="3x" style={{ color: '#e53e3e', marginBottom: '16px' }} />
            <h3>Unable to Close Case</h3>
            <p>{error}</p>
            <button 
              onClick={() => navigate('/cases')}
              className="btn-secondary"
              style={{ marginTop: '16px' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '8px' }} />
              Back to Cases
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Close Case with Report"
          subtitle={`Close case "${caseData?.case_number}" with a detailed closure report`}
          icon={faLock}
          actions={
            <button 
              onClick={() => navigate('/cases')}
              className="btn-secondary"
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '8px' }} />
              Back to Cases
            </button>
          }
        />

        <div className="upload-form" style={{ maxWidth: '700px', margin: '0 auto' }}>
          {error && <div className="error-message">{error}</div>}

          {/* Case Summary */}
          <div style={{ 
            padding: '16px', 
            background: '#f7fafc', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px' }} />
              Case Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
              <div><strong>Case Number:</strong> {caseData?.case_number}</div>
              <div><strong>Title:</strong> {caseData?.title}</div>
              <div><strong>Crime:</strong> {caseData?.crime_id}</div>
              <div><strong>Created By:</strong> {caseData?.created_by}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Description:</strong> {caseData?.description || 'No description provided'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* File Upload */}
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faUpload} style={{ marginRight: '8px' }} />
                Closure Report File (Required)
              </label>
              <div style={{
                border: '2px dashed #e2e8f0',
                borderRadius: '8px',
                padding: '30px 20px',
                textAlign: 'center',
                background: '#f7fafc',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#0f3460';
                e.currentTarget.style.background = '#edf2f7';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#f7fafc';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#f7fafc';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setFile(e.dataTransfer.files[0]);
                  setError('');
                }
              }}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="closure-report-file"
                  accept=".pdf,.doc,.docx,.txt,.csv"
                />
                <label htmlFor="closure-report-file" style={{ cursor: 'pointer', display: 'block' }}>
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <FontAwesomeIcon icon={faFile} size="2x" style={{ color: '#0f3460' }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600', color: '#2d3748' }}>{file.name}</div>
                        <div style={{ fontSize: '13px', color: '#718096' }}>
                          {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FontAwesomeIcon icon={faUpload} size="3x" style={{ color: '#a0aec0', marginBottom: '12px' }} />
                      <p style={{ color: '#4a5568', margin: 0 }}>
                        <strong>Click to upload</strong> or drag and drop
                      </p>
                      <p style={{ color: '#718096', fontSize: '13px', marginTop: '4px' }}>
                        Supported: PDF, Word, Text (Max 10MB)
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px' }} />
                Case Closure Description (Required)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a detailed description of why this case is being closed. Include case outcome, sentencing details, or other relevant information."
                rows="5"
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
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                Minimum 20 characters
              </p>
            </div>

            {/* Progress Bar */}
            {submitting && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#4a5568' }}>
                  <span>Uploading closure report...</span>
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
                    background: 'linear-gradient(90deg, #0f3460, #4a6fa5)',
                    borderRadius: '3px',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !file || !description.trim()}
              className="auth-btn"
              style={{
                width: '100%',
                padding: '14px',
                background: (submitting || !file || !description.trim()) ? '#a0aec0' : '#0f3460',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (submitting || !file || !description.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                  Closing Case... {uploadProgress}%
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
                  Close Case with Report
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
              About Case Closure
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloseCaseWithReport;


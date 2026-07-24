import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShieldAlt, faCheckCircle, faTimesCircle, 
  faFile, faSpinner, faHistory, faUser,
  faCalendar, faExclamationTriangle,
  faUpload
} from '@fortawesome/free-solid-svg-icons';
import { showSuccess, showError } from './ToastNotifications';
import '../App.css';

const FileVerification = ({ 
  evidenceId, 
  fileName, 
  fileType,
  onClose,
  isSupportingEvidence = false
}) => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Calculate IPFS hash via backend proxy (solves CORS issues)
  const calculateIpfsHash = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      // Send to backend proxy endpoint instead of directly to IPFS
      const response = await axios.post('http://localhost:5000/api/ipfs/hash', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      return response.data.ipfsHash;
    } catch (error) {
      console.error('IPFS hash calculation error:', error);
      throw new Error(error.response?.data?.error || 'Failed to calculate file hash');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setError('Please select a file to verify');
      return;
    }

    setVerifying(true);
    setError('');
    setResult(null);
    setUploadProgress(0);

    try {
      // Step 1: Calculate the IPFS hash via backend
      setUploadProgress(30);
      console.log(`📤 Calculating IPFS hash for file "${file.name}"...`);
      const fileHash = await calculateIpfsHash(file);
      console.log(`✅ IPFS Hash calculated: ${fileHash}`);
      setUploadProgress(60);

      // Step 2: Verify against blockchain
      const endpoint = isSupportingEvidence 
        ? `http://localhost:5000/api/supporting-evidence/${evidenceId}/verify`
        : `http://localhost:5000/api/evidence/${evidenceId}/verify`;

      console.log(`🔍 Verifying against blockchain...`);
      const response = await axios.post(endpoint, 
        { fileHash },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUploadProgress(100);
      setResult(response.data);
      
      if (response.data.verified) {
        showSuccess('✅ File verified successfully! The file matches the blockchain record.');
      } else {
        showError('❌ File verification failed. The file does not match the blockchain record.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to verify file';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setVerifying(false);
    }
  };

  const renderVerificationResult = () => {
    if (!result) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`verification-result ${result.verified ? 'verified' : 'failed'}`}
      >
        <div className="verification-header">
          <div className={`verification-icon ${result.verified ? 'success' : 'error'}`}>
            <FontAwesomeIcon icon={result.verified ? faCheckCircle : faTimesCircle} />
          </div>
          <h3>{result.verified ? '✅ File Verified!' : '❌ Verification Failed'}</h3>
          <p>{result.message}</p>
        </div>

        <div className="verification-details">
          <div className="detail-row">
            <span className="detail-label">Evidence ID</span>
            <span className="detail-value">{result.evidenceId || result.supportingId}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">File Name</span>
            <span className="detail-value">{result.fileName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Blockchain Hash</span>
            <span className="detail-value hash">{result.blockchainHash}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Calculated Hash</span>
            <span className="detail-value hash">{result.submittedHash}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Match Status</span>
            <span className={`detail-value ${result.matches ? 'match' : 'mismatch'}`}>
              {result.matches ? '✅ Matches' : '❌ Mismatch'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Verified By</span>
            <span className="detail-value">{result.verifiedBy}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Verified At</span>
            <span className="detail-value">{new Date(result.timestamp).toLocaleString()}</span>
          </div>
        </div>

        {result.history && result.history.length > 0 && (
          <div className="verification-history">
            <h4>
              <FontAwesomeIcon icon={faHistory} style={{ marginRight: '8px' }} />
              Chain of Custody History
            </h4>
            <div className="history-timeline">
              {result.history.map((log, index) => (
                <div key={index} className="history-item">
                  <div className="history-dot" />
                  <div className="history-content">
                    <div className="history-action">{log.action}</div>
                    <div className="history-notes">{log.notes}</div>
                    <div className="history-meta">
                      <span>
                        <FontAwesomeIcon icon={faUser} /> {log.actorId}
                      </span>
                      <span>
                        <FontAwesomeIcon icon={faCalendar} /> {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="verification-seal">
          <FontAwesomeIcon icon={faShieldAlt} />
          <span>Blockchain Verified</span>
          <span className="seal-timestamp">{new Date(result.timestamp).toLocaleString()}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="file-verification">
      <div className="verification-header-bar">
        <h3>
          <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '8px' }} />
          File Verification
        </h3>
        <button className="close-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faTimesCircle} />
        </button>
      </div>

      <div className="verification-body">
        <div className="verification-info">
          <p>
            <FontAwesomeIcon icon={faFile} style={{ marginRight: '8px' }} />
            Verifying: <strong>{fileName || 'Unknown file'}</strong>
          </p>
          <p className="verification-instructions">
            Upload the original file to verify its authenticity against the blockchain record.
          </p>
        </div>

        {error && (
          <div className="error-message">
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px' }} />
            {error}
          </div>
        )}

        <div className="file-upload-area">
          <div className="file-input-wrapper">
            <input
              type="file"
              onChange={handleFileChange}
              className="file-input"
              id="verification-file"
            />
            <label htmlFor="verification-file" className="file-input-label">
              <FontAwesomeIcon icon={faUpload} size="2x" />
              <span>Click to upload or drag file here</span>
              <span className="file-input-hint">Select the original file to verify</span>
            </label>
          </div>
          {file && (
            <div className="selected-file">
              <FontAwesomeIcon icon={faFile} />
              <span>{file.name}</span>
              <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
              <button className="remove-file" onClick={() => setFile(null)}>
                <FontAwesomeIcon icon={faTimesCircle} />
              </button>
            </div>
          )}
        </div>

        {verifying && (
          <div className="verification-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="progress-text">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Verifying file... {uploadProgress}%</span>
            </div>
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={!file || verifying}
          className={`verify-btn ${verifying ? 'verifying' : ''}`}
        >
          {verifying ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              Verifying...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faShieldAlt} />
              Verify File
            </>
          )}
        </button>

        <AnimatePresence>
          {result && renderVerificationResult()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FileVerification;


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../App.css';

const UploadSupportingEvidence = () => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [cases, setCases] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'Analyst') {
      navigate('/');
      return;
    }
    fetchCases();
  }, [user, navigate]);

  const fetchCases = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/cases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter cases assigned to this analyst
      const assignedCases = (res.data.data || res.data).filter(c => c.analyst_id === user.username);
      setCases(assignedCases);
      
      if (assignedCases.length === 0) {
        setMessage('⚠️ You are not assigned to any cases yet. Please contact an administrator to be assigned to a case.');
      }
    } catch (err) {
      console.error('Failed to load cases');
      setError('Failed to load assigned cases');
    }
  };

  const fetchEvidence = async (caseId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/evidence?caseId=${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let evidenceData = [];
      if (Array.isArray(res.data)) {
        evidenceData = res.data;
      } else if (res.data && res.data.data !== undefined) {
        evidenceData = res.data.data || [];
      }
      setEvidenceList(evidenceData);
    } catch (err) {
      console.error('Failed to load evidence');
      setEvidenceList([]);
    }
  };

  const handleCaseChange = (e) => {
    const caseId = e.target.value;
    setSelectedCase(caseId);
    setSelectedEvidence('');
    setEvidenceList([]);
    if (caseId) {
      fetchEvidence(caseId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!selectedCase) {
      setError('Please select a case');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description for this supporting evidence');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'text/plain', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      setError(`File type "${file.type}" not allowed. Please upload images, PDFs, Word documents, text files, or MP4 videos.`);
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('caseId', selectedCase);
    formData.append('evidenceId', selectedEvidence);

    try {
      const response = await axios.post('http://localhost:5000/api/supporting-evidence/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      setMessage(`✅ ${response.data.message || 'Supporting evidence uploaded successfully!'}`);
      setFile(null);
      setDescription('');
      setSelectedCase('');
      setSelectedEvidence('');
      setEvidenceList([]);
      
      setTimeout(() => {
        navigate('/supporting-evidence');
      }, 2000);
      
    } catch (err) {
      console.error('Upload Error:', err.response?.data || err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="dashboard-header">
          <h1>📤 Upload Supporting Evidence</h1>
          <p>Upload a supporting report or file for a case you are assigned to</p>
        </div>

        <div className="upload-form">
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Case (Required)</label>
              <select 
                value={selectedCase} 
                onChange={handleCaseChange}
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
                {cases.map(c => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_number} - {c.title}
                  </option>
                ))}
              </select>
              {cases.length === 0 && (
                <p style={{ fontSize: '13px', color: '#e53e3e', marginTop: '8px' }}>
                  ⚠️ You are not assigned to any cases. Please contact an administrator.
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Link to Specific Evidence (Optional)</label>
              <select 
                value={selectedEvidence} 
                onChange={(e) => setSelectedEvidence(e.target.value)}
                disabled={!selectedCase}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: selectedCase ? 'white' : '#f7fafc'
                }}
              >
                <option value="">-- Link to evidence (optional) --</option>
                {evidenceList.map(e => (
                  <option key={e.evidence_id} value={e.evidence_id}>
                    {e.file_name} {e.description && `- ${e.description.substring(0, 30)}...`}
                  </option>
                ))}
              </select>
              {selectedCase && evidenceList.length === 0 && (
                <p style={{ fontSize: '13px', color: '#718096', marginTop: '8px' }}>
                  No evidence files found for this case. You can upload supporting evidence without linking to specific evidence.
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Select File (Required)</label>
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])} 
                required 
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  background: 'white'
                }}
              />
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                Supported files: Images, PDFs, Word documents, Text files, MP4 videos (Max 50MB)
              </p>
            </div>
            
            <div className="form-group">
              <label>Description (Required)</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Explain what this supporting evidence is and why it's relevant to the case"
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
            </div>

            <button 
              type="submit" 
              disabled={uploading || cases.length === 0} 
              className="auth-btn"
              style={{
                width: '100%',
                padding: '14px',
                background: (uploading || cases.length === 0) ? '#a0aec0' : '#0f3460',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (uploading || cases.length === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {uploading ? 'Uploading...' : cases.length === 0 ? 'No Cases Assigned' : 'Upload Supporting Evidence'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadSupportingEvidence;
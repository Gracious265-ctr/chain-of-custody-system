import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import FileVerification from '../components/FileVerification';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const FileVerificationPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState('');
  const [isSupportingEvidence, setIsSupportingEvidence] = useState(false);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        // Try to fetch as regular evidence first
        try {
          const res = await axios.get(`http://localhost:5000/api/evidence/${id}/report`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setEvidence(res.data);
          setIsSupportingEvidence(false);
        } catch (err) {
          // If not found, try supporting evidence
          const res = await axios.get(`http://localhost:5000/api/supporting-evidence/${id}/report`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setEvidence(res.data);
          setIsSupportingEvidence(true);
        }
      } catch (err) {
        setError('Failed to load evidence');
        showError('Failed to load evidence');
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [id, token]);

  if (loading) return <LoadingSpinner message="Loading evidence..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="File Verification"
          subtitle={`Verify the authenticity of "${evidence?.fileName || 'Unknown file'}"`}
          icon={faShieldAlt}
          actions={
            <button 
              onClick={() => navigate('/evidence')}
              className="btn-secondary"
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '8px' }} />
              Back to Evidence
            </button>
          }
        />

        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <FileVerification
            evidenceId={id}
            fileName={evidence?.fileName}
            fileType={evidence?.fileType}
            isSupportingEvidence={isSupportingEvidence}
            onClose={() => navigate('/evidence')}
          />
        </div>
      </div>
    </div>
  );
};

export default FileVerificationPage;


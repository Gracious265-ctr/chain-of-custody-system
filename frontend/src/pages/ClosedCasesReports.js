import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFile, faDownload, faEye, faCalendar,
  faUser, faFolder, faLock, faFileAlt,
  faSearch, faClock
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import '../App.css';

const ClosedCasesReports = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClosedReports();
  }, [token]);

  const fetchClosedReports = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/cases/closed-reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data);
    } catch (err) {
      console.error('Fetch Error:', err);
      setError('Failed to load closed case reports');
      showError('Failed to load closed case reports');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (caseId) => {
    const viewUrl = `http://localhost:5000/api/cases/${caseId}/closure-report/view?token=Bearer ${token}`;
    window.open(viewUrl, '_blank');
  };

  const handleDownload = (caseId, fileName) => {
    const downloadUrl = `http://localhost:5000/api/cases/${caseId}/closure-report/download?token=Bearer ${token}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const filteredReports = reports.filter(report =>
    report.caseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.closedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.reportName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Loading closed case reports..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Closed Cases & Reports"
          subtitle="View all closed cases and their closure reports"
          icon={faLock}
        />

        {/* Search Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ position: 'relative' }}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
            <input
              type="text"
              placeholder="Search by case number, title, prosecutor, or report name..."
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
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <div className="no-reports" style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            color: '#718096',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>No closed case reports found</h3>
            <p style={{ margin: 0 }}>
              {searchTerm 
                ? 'No reports match your search criteria.'
                : 'No cases have been closed with reports yet.'}
            </p>
          </div>
        ) : (
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {filteredReports.map((report) => (
              <div key={report.caseId} className="enhanced-card" style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f3460' }}>
                      <FontAwesomeIcon icon={faFolder} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                      {report.caseNumber}
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#2d3748' }}>
                      {report.title}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: '#fed7d7',
                    color: '#9b2c2c'
                  }}>
                    🔒 Closed
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#4a5568' }}>
                  <div>
                    <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                    <strong>Closed By:</strong> {report.closedBy || 'Unknown'}
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '8px', color: '#718096' }} />
                    <strong>Closure Date:</strong> {formatDate(report.closureDate)}
                  </div>
                  <div>
                    <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px', color: '#4a6fa5' }} />
                    <strong>Report File:</strong> {report.reportName || 'N/A'}
                  </div>
                  {report.description && (
                    <div>
                      <FontAwesomeIcon icon={faFile} style={{ marginRight: '8px', color: '#718096' }} />
                      <strong>Description:</strong> {report.description}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  marginTop: '8px', 
                  borderTop: '1px solid #edf2f7', 
                  paddingTop: '14px', 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '10px' 
                }}>
                  <button
                    onClick={() => handleView(report.caseId)}
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '13px', background: '#3182ce' }}
                  >
                    <FontAwesomeIcon icon={faEye} style={{ marginRight: '6px' }} />
                    View Report
                  </button>
                  <button
                    onClick={() => handleDownload(report.caseId, report.reportName)}
                    className="btn-success"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: '6px' }} />
                    Download Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClosedCasesReports;


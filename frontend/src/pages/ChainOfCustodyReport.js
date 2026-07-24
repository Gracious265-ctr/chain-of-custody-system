import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showError } from '../components/ToastNotifications';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, faDownload, faArrowLeft, 
  faCheckCircle, faExclamationTriangle, 
  faClock, faUser, faFolder, faCalendar,
  faShieldAlt, faLock
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const ChainOfCustodyReport = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/evidence/${id}/report`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReport(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load Chain of Custody report');
        showError(err.response?.data?.error || 'Failed to load Chain of Custody report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, token]);

  const generatePDF = () => {
    if (!report) {
      showError('Report data is not available yet. Please wait for it to load.');
      return;
    }

    try {
      const doc = new jsPDF();

      const evidenceId = report.evidenceId || 'N/A';
      const fileName = report.fileName || 'Unknown File';
      const description = report.description || 'No description provided';
      const ipfsHash = report.ipfsHash || 'N/A';
      const fileType = report.fileType || 'Unknown';
      const size = report.size || 0;
      const uploader = report.uploader || 'Unknown';
      const uploadedAt = report.uploadedAt || new Date().toISOString();
      const caseData = report.case || null;
      const history = report.history || [];

      // Header / Seal
      doc.setFillColor(15, 52, 96);
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.text('CHAIN OF CUSTODY REPORT', 105, 22, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Blockchain Verified · Tamper-Proof · Court Admissible', 105, 34, { align: 'center' });

      // Case Details Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('CASE DETAILS', 14, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      let currentY = 75;

      const printField = (label, value, y) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        const displayValue = value || 'N/A';
        const maxLength = 40;
        const truncatedValue = displayValue.length > maxLength 
          ? displayValue.substring(0, maxLength) + '...' 
          : displayValue;
        doc.text(truncatedValue, 44, y);
      };

      if (caseData) {
        printField('Case Number', caseData.case_number, currentY); currentY += 8;
        printField('Case Title', caseData.title, currentY); currentY += 8;
        printField('Case Description', caseData.description, currentY); currentY += 8;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text('No case assigned to this evidence.', 44, currentY);
        currentY += 8;
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
      }

      currentY += 5;

      // Evidence Summary
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('EVIDENCE SUMMARY', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      currentY += 10;

      const leftColX = 14;

      const printField2 = (label, value, y) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, leftColX, y);
        doc.setFont('helvetica', 'normal');
        const displayValue = value || 'N/A';
        const maxLength = 40;
        const truncatedValue = displayValue.length > maxLength 
          ? displayValue.substring(0, maxLength) + '...' 
          : displayValue;
        doc.text(truncatedValue, leftColX + 30, y);
      };

      printField2('Evidence ID', evidenceId, currentY); currentY += 8;
      printField2('File Name', fileName, currentY); currentY += 8;
      printField2('Description', description, currentY); currentY += 8;
      printField2('File Type', fileType, currentY); currentY += 8;
      printField2('File Size', `${(size / 1024 / 1024).toFixed(2)} MB`, currentY); currentY += 8;
      printField2('Uploaded By', uploader, currentY); currentY += 8;
      printField2('Upload Date', new Date(uploadedAt).toLocaleString(), currentY); currentY += 8;
      
      const displayIpfsHash = ipfsHash.length > 30 
        ? ipfsHash.substring(0, 30) + '...' 
        : ipfsHash;
      printField2('IPFS Hash', displayIpfsHash, currentY); currentY += 10;

      // History Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('BLOCKCHAIN CHAIN OF CUSTODY HISTORY', 14, currentY + 10);

      if (history.length > 0) {
        const getActionLabel = (action) => {
          const labels = {
            'EVIDENCE_UPLOAD': '📤 Evidence Upload',
            'EVIDENCE_VIEW': '👁️ Evidence View',
            'COURT_READY': '⚖️ Court Ready',
            'WEAK_EVIDENCE': '⚠️ Weak Evidence',
            'EVIDENCE_CASE_ASSIGN': '📋 Case Assignment',
            'EVIDENCE_ARCHIVED': '🗄️ Evidence Archived',
            'EVIDENCE_RESTORED': '📦 Evidence Restored',
            'SUPPORTING_EVIDENCE_UPLOAD': '📄 Supporting Evidence Upload',
            'SUPPORTING_EVIDENCE_VIEW': '👁️ Supporting Evidence View'
          };
          return labels[action] || action;
        };

        const tableData = history.map((log, index) => [
          index + 1,
          getActionLabel(log.action),
          log.notes || 'No details',
          log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'
        ]);

        autoTable(doc, {
          startY: currentY + 18,
          head: [['#', 'Action', 'Description', 'Timestamp']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontSize: 9, halign: 'center' },
          styles: { fontSize: 8, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 85 },
            3: { cellWidth: 55 }
          },
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
              `This document is cryptographically verified by the Blockchain. Page ${data.pageNumber} of ${pageCount}`,
              105, 285, { align: 'center' }
            );
            doc.text(`IPFS Hash: ${ipfsHash}`, 105, 292, { align: 'center', fontSize: 7 });
          }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('No chain of custody history available for this evidence.', 105, currentY + 30, { align: 'center' });
      }

      const safeFileName = `Chain_of_Custody_${evidenceId.substring(0, 8) || 'Unknown'}.pdf`;
      doc.save(safeFileName);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      showError('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) return <LoadingSpinner message="Loading Chain of Custody from Blockchain..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Chain of Custody Report"
          subtitle="Forensic Evidence Report · Blockchain Verified"
          icon={faFileAlt}
          actions={
            <>
              <button 
                onClick={() => navigate('/evidence')}
                className="btn-secondary"
              >
                <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '8px' }} />
                Back to Evidence
              </button>
              <button 
                onClick={generatePDF}
                className="btn-primary"
              >
                <FontAwesomeIcon icon={faDownload} style={{ marginRight: '8px' }} />
                Download PDF
              </button>
            </>
          }
        />

        {/* Report Content */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          
          {/* Header Seal */}
          <div style={{ background: '#0f3460', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '30px' }}>
            <FontAwesomeIcon icon={faShieldAlt} size="2x" style={{ marginBottom: '8px' }} />
            <h2 style={{ margin: 0, letterSpacing: '1px' }}>CHAIN OF CUSTODY REPORT</h2>
            <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
              Blockchain Verified · Tamper-Proof · Court Admissible
            </p>
          </div>

          {/* Case Details Section */}
          {report?.case && (
            <div style={{ 
              background: '#f0f4f8', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '30px',
              borderLeft: '4px solid #0f3460'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0f3460' }}>
                <FontAwesomeIcon icon={faFolder} style={{ marginRight: '8px' }} />
                Assigned Case
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <FontAwesomeIcon icon={faFolder} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                  <strong>Case Number:</strong> {report.case.case_number || 'N/A'}
                </div>
                <div>
                  <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                  <strong>Case Title:</strong> {report.case.title || 'N/A'}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
                  <strong>Case Description:</strong> {report.case.description || 'No description provided'}
                </div>
              </div>
            </div>
          )}

          {/* Evidence Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>Evidence ID:</strong> 
              <span style={{ fontFamily: 'monospace', fontSize: '13px', marginLeft: '4px' }}>
                {report?.evidenceId || 'N/A'}
              </span>
            </div>
            <div>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>File Name:</strong> {report?.fileName || 'Unknown'}
            </div>
            <div>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>Description:</strong> {report?.description || 'No description provided'}
            </div>
            <div>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>File Type:</strong> {report?.fileType || 'Unknown'}
            </div>
            <div>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>File Size:</strong> {report?.size ? (report.size / 1024 / 1024).toFixed(2) : '0'} MB
            </div>
            <div>
              <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>Uploaded By:</strong> {report?.uploader || 'Unknown'}
            </div>
            <div>
              <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>Upload Date:</strong> {report?.uploadedAt ? new Date(report.uploadedAt).toLocaleString() : 'N/A'}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '4px', color: '#4a6fa5' }} />
              <strong>IPFS Hash (CID):</strong> 
              <span style={{ fontFamily: 'monospace', background: '#edf2f7', padding: '4px 8px', borderRadius: '4px', marginLeft: '8px' }}>
                {report?.ipfsHash || 'N/A'}
              </span>
            </div>
          </div>

          {/* History Table */}
          <h3 style={{ borderBottom: '2px solid #0f3460', paddingBottom: '10px', marginBottom: '20px' }}>
            <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px' }} />
            Blockchain Chain of Custody History
          </h3>
          <div className="evidence-table-container">
            {report?.history && report.history.length > 0 ? (
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Description</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {report.history.map((log, index) => {
                    const getActionLabel = (action) => {
                      const labels = {
                        'EVIDENCE_UPLOAD': '📤 Evidence Upload',
                        'EVIDENCE_VIEW': '👁️ Evidence View',
                        'COURT_READY': '⚖️ Court Ready',
                        'WEAK_EVIDENCE': '⚠️ Weak Evidence',
                        'EVIDENCE_CASE_ASSIGN': '📋 Case Assignment',
                        'EVIDENCE_ARCHIVED': '🗄️ Evidence Archived',
                        'EVIDENCE_RESTORED': '📦 Evidence Restored',
                        'SUPPORTING_EVIDENCE_UPLOAD': '📄 Supporting Evidence Upload',
                        'SUPPORTING_EVIDENCE_VIEW': '👁️ Supporting Evidence View'
                      };
                      return labels[action] || action;
                    };
                    
                    return (
                      <tr key={index}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td>
                          <span className="role-badge" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            background: '#edf2f7'
                          }}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left', lineHeight: '1.6' }}>{log.notes || 'No details'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'N/A'}</span>
                            <span style={{ fontSize: '12px', color: '#718096' }}>
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
                <p>No chain of custody history available for this evidence.</p>
              </div>
            )}
          </div>

          {/* Footer Watermark */}
          <div style={{ marginTop: '30px', textAlign: 'center', color: '#a0aec0', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <p>
              <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '8px' }} />
              This report was generated from the immutable Ethereum Blockchain.
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
              CID: {report?.ipfsHash || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChainOfCustodyReport;


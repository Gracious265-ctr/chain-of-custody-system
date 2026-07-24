import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showError } from '../components/ToastNotifications';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, ComposedChart
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartBar, faFile, faFolder, faUsers, faClock,
  faCheckCircle, faExclamationTriangle, faArchive,
  faFileAlt, faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import '../App.css';

const AnalyticsDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        console.log('📊 Fetching analytics data...');
        const response = await axios.get('http://localhost:5000/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('📊 Analytics data received:', response.data);
        setData(response.data);
      } catch (err) {
        console.error('❌ Failed to load analytics:', err);
        const errorMsg = err.response?.data?.error || 'Failed to load analytics data';
        const details = err.response?.data?.details || err.message;
        setError(errorMsg);
        setErrorDetails(details);
        showError(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [token]);

  const COLORS = ['#0f3460', '#4a6fa5', '#48bb78', '#f0ad4e', '#e53e3e', '#9f7aea', '#ed64a6', '#38a169'];
  const STATUS_COLORS = ['#48bb78', '#e53e3e', '#f0ad4e', '#a0aec0'];

  if (loading) return <LoadingSpinner message="Loading Analytics..." fullPage />;
  
  if (error) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <div className="error-message" style={{ padding: '30px', textAlign: 'center' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} size="3x" style={{ color: '#e53e3e', marginBottom: '16px' }} />
            <h3>Failed to Load Analytics</h3>
            <p>{error}</p>
            {errorDetails && (
              <p style={{ fontSize: '13px', color: '#718096', marginTop: '8px' }}>
                <strong>Details:</strong> {errorDetails}
              </p>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary"
              style={{ marginTop: '16px' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) return <div className="loading">No analytics data available.</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="Advanced Analytics"
          subtitle="Insights and statistics for evidence management"
          icon={faChartBar}
        />

        {/* Summary Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
          <div className="stat-card" onClick={() => navigate('/evidence')} style={{ cursor: 'pointer' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon" style={{ background: '#0f3460' }}>
                <FontAwesomeIcon icon={faFile} />
              </div>
            </div>
            <div className="stat-card-body">
              <h3 className="stat-card-title">Total Evidence</h3>
              <div className="stat-card-value">{data.totals.totalEvidence}</div>
              <p className="stat-card-subtitle">Files uploaded to blockchain</p>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/cases')} style={{ cursor: 'pointer' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon" style={{ background: '#4a6fa5' }}>
                <FontAwesomeIcon icon={faFolder} />
              </div>
            </div>
            <div className="stat-card-body">
              <h3 className="stat-card-title">Total Cases</h3>
              <div className="stat-card-value">{data.totals.totalCases}</div>
              <p className="stat-card-subtitle">Active: {data.caseStatus.active} | Closed: {data.caseStatus.closed}</p>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/users')} style={{ cursor: 'pointer' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon" style={{ background: '#48bb78' }}>
                <FontAwesomeIcon icon={faUsers} />
              </div>
            </div>
            <div className="stat-card-body">
              <h3 className="stat-card-title">Total Users</h3>
              <div className="stat-card-value">{data.totals.totalUsers}</div>
              <p className="stat-card-subtitle">Registered in the system</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon" style={{ background: '#9f7aea' }}>
                <FontAwesomeIcon icon={faArrowTrendUp} />
              </div>
            </div>
            <div className="stat-card-body">
              <h3 className="stat-card-title">Total Crimes</h3>
              <div className="stat-card-value">{data.totals.totalCrimes}</div>
              <p className="stat-card-subtitle">Crime types registered</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="dashboard-grid-analytics">
          
          {/* Evidence by Month */}
          <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px', color: '#0f3460' }} />
              Evidence Uploads by Month (Last 6 Months)
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evidenceByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#0f3460" fill="#4a6fa5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evidence by File Type */}
          <div className="analytics-card">
            <h3>
              <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: '8px', color: '#0f3460' }} />
              Evidence by File Type
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={data.evidenceByFileType} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    fill="#8884d8" 
                    dataKey="count" 
                    label
                  >
                    {data.evidenceByFileType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evidence by Status */}
          <div className="analytics-card">
            <h3>
              <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '8px', color: '#0f3460' }} />
              Evidence by Status
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={[
                      { name: 'Court Ready', value: data.evidenceByStatus.courtReady },
                      { name: 'Weak', value: data.evidenceByStatus.weak },
                      { name: 'Pending', value: data.evidenceByStatus.pending },
                      { name: 'Archived', value: data.evidenceByStatus.archived }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    fill="#8884d8" 
                    dataKey="value" 
                    label
                  >
                    {STATUS_COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Uploads by User */}
          <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <FontAwesomeIcon icon={faUsers} style={{ marginRight: '8px', color: '#0f3460' }} />
              Top Uploaders
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.uploadsByUser} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="user" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f3460" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evidence by Case */}
          <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <FontAwesomeIcon icon={faFolder} style={{ marginRight: '8px', color: '#0f3460' }} />
              Evidence by Case (Top 10)
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.evidenceByCase}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="caseNumber" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4a6fa5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Size Distribution */}
          <div className="analytics-card">
            <h3>
              <FontAwesomeIcon icon={faFile} style={{ marginRight: '8px', color: '#0f3460' }} />
              File Size Distribution
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sizeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f0ad4e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cases by Crime */}
          <div className="analytics-card">
            <h3>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px', color: '#0f3460' }} />
              Cases by Crime Type (Top 10)
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.casesByCrime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="crimeName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#e53e3e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px', color: '#0f3460' }} />
              Recent Activity (Last 20 Events)
            </h3>
            <div className="evidence-table-container">
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((activity, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '500' }}>{activity.fileName}</td>
                      <td>
                        <span className="role-badge">
                          {activity.action}
                        </span>
                      </td>
                      <td>{activity.actorId}</td>
                      <td>{new Date(activity.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

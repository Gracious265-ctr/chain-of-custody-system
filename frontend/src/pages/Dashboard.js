import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { showError } from '../components/ToastNotifications';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFile, faFolder, faBuilding, faBalanceScale, 
  faCheckCircle, faExclamationTriangle, faClock,
  faChartBar, faFileAlt, faGavel, faShieldAlt,
  faLock, faLink, faUser
} from '@fortawesome/free-solid-svg-icons';
import { motion } from 'framer-motion';
import axios from 'axios';
import '../App.css';

const Dashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let endpoint = '';
        
        if (user?.role === 'SuperAdmin') {
          endpoint = '/api/dashboard/admin';
        } else if (user?.role === 'StationAdmin') {
          endpoint = '/api/dashboard/admin';
        } else if (user?.role === 'Prosecutor') {
          endpoint = '/api/dashboard/prosecutor';
        } else if (user?.role === 'Officer') {
          endpoint = '/api/dashboard/officer';
        } else if (user?.role === 'Analyst') {
          endpoint = '/api/dashboard/analyst';
        }

        console.log(`📊 Fetching dashboard data from: ${endpoint}`);
        
        const response = await axios.get(`http://localhost:5000${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('📊 Dashboard data received:', response.data);
        
        // Ensure data has all expected properties with defaults
        const defaultData = {
          evidenceCount: 0,
          fileTypes: [],
          caseCount: 0,
          stationCount: 0,
          crimeCount: 0,
          crimeVsCases: [],
          courtReadiness: { courtReady: 0, weak: 0, pending: 0 },
          fileSizes: [],
          weeklyUploads: [],
          evidencePerCase: [],
          supportingEvidenceCount: 0,
          weakEvidenceCount: 0,
          courtReadyCount: 0,
          pendingReviewCount: 0,
          myUploadsCount: 0,
          assignedCases: 0,
          timeline: []
        };
        
        setData({ ...defaultData, ...response.data });
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setError(err.response?.data?.error || 'Failed to load dashboard data');
        showError(err.response?.data?.error || 'Failed to load dashboard data');
        // Set default data to prevent crashes
        setData({
          evidenceCount: 0,
          fileTypes: [],
          caseCount: 0,
          stationCount: 0,
          crimeCount: 0,
          crimeVsCases: [],
          courtReadiness: { courtReady: 0, weak: 0, pending: 0 },
          fileSizes: [],
          weeklyUploads: [],
          evidencePerCase: [],
          supportingEvidenceCount: 0,
          weakEvidenceCount: 0,
          courtReadyCount: 0,
          pendingReviewCount: 0,
          myUploadsCount: 0,
          assignedCases: 0,
          timeline: []
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (user && token) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  if (loading) return <LoadingSpinner message="Loading Dashboard Analytics..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;
  if (!data) return <div className="loading">No data available.</div>;

  const COLORS_TYPES = ['#0f3460', '#4a6fa5', '#48bb78', '#f0ad4e', '#e53e3e', '#9f7aea'];
  const COLORS_STATUS = ['#48bb78', '#e53e3e', '#f0ad4e'];
  const COLORS_CRIME = ['#0f3460', '#4a6fa5', '#48bb78', '#f0ad4e', '#e53e3e', '#9f7aea', '#ed64a6'];

  // Prepare stat cards based on user role
  const getStatCards = () => {
    const cards = [];
    
    // Common cards for all roles
    cards.push({
      icon: faFile,
      title: 'Total Evidence',
      value: data?.evidenceCount || 0,
      subtitle: 'Uploaded to blockchain',
      color: '#0f3460',
      onClick: () => navigate('/evidence')
    });

    // Admin-specific cards
    if (user?.role === 'SuperAdmin' || user?.role === 'StationAdmin') {
      cards.push({
        icon: faFolder,
        title: 'Total Cases',
        value: data?.caseCount || 0,
        subtitle: 'Active investigations',
        color: '#4a6fa5',
        onClick: () => navigate('/cases')
      });
      cards.push({
        icon: faGavel,
        title: 'Total Crimes',
        value: data?.crimeCount || 0,
        subtitle: 'Crime types registered',
        color: '#48bb78'
      });
    }

    // SuperAdmin-specific cards
    if (user?.role === 'SuperAdmin') {
      cards.push({
        icon: faBuilding,
        title: 'Total Stations',
        value: data?.stationCount || 0,
        subtitle: 'Police stations',
        color: '#9f7aea',
        onClick: () => navigate('/stations')
      });
    }

    // Prosecutor-specific cards
    if (user?.role === 'Prosecutor') {
      const { courtReady = 0, weak = 0, pending = 0 } = data.courtReadiness || {};
      cards.push({
        icon: faCheckCircle,
        title: 'Court Ready',
        value: courtReady,
        subtitle: 'Ready for trial',
        color: '#48bb78'
      });
      cards.push({
        icon: faExclamationTriangle,
        title: 'Weak Evidence',
        value: weak,
        subtitle: 'Requires attention',
        color: '#e53e3e'
      });
      cards.push({
        icon: faClock,
        title: 'Pending Review',
        value: pending,
        subtitle: 'Awaiting assessment',
        color: '#f0ad4e'
      });
    }

    // Analyst-specific cards
    if (user?.role === 'Analyst') {
      cards.push({
        icon: faFolder,
        title: 'Assigned Cases',
        value: data?.caseCount || 0,
        subtitle: 'Cases under review',
        color: '#4a6fa5',
        onClick: () => navigate('/cases')
      });
      cards.push({
        icon: faFileAlt,
        title: 'Supporting Files',
        value: data?.supportingEvidenceCount || 0,
        subtitle: 'Uploaded by you',
        color: '#9f7aea',
        onClick: () => navigate('/supporting-evidence')
      });
      cards.push({
        icon: faExclamationTriangle,
        title: 'Weak Evidence',
        value: data?.weakEvidenceCount || 0,
        subtitle: 'Needs analysis',
        color: '#e53e3e'
      });
    }

    // Officer-specific cards
    if (user?.role === 'Officer') {
      cards.push({
        icon: faFolder,
        title: 'My Cases',
        value: data?.caseCount || 0,
        subtitle: 'Cases you created',
        color: '#4a6fa5',
        onClick: () => navigate('/cases')
      });
    }

    return cards;
  };

  const statCards = getStatCards();

  // Get chart title based on user role
  const getChartTitle = () => {
    switch (user?.role) {
      case 'SuperAdmin':
      case 'StationAdmin':
        return 'Evidence by File Type';
      case 'Prosecutor':
        return 'Court Readiness Status';
      case 'Officer':
        return 'Weekly Uploads';
      case 'Analyst':
        return 'Evidence per Assigned Case';
      default:
        return 'Analytics';
    }
  };

  // Get chart component based on user role
  const renderChart = () => {
    switch (user?.role) {
      case 'SuperAdmin':
      case 'StationAdmin':
        return (
          <div className="analytics-card">
            <h3>{getChartTitle()}</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={data.fileTypes || []} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100} 
                    fill="#8884d8" 
                    dataKey="value" 
                    label
                  >
                    {(data.fileTypes || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_TYPES[index % COLORS_TYPES.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'Prosecutor':
        return (
          <div className="analytics-card">
            <h3>{getChartTitle()}</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={[
                      { name: 'Court Ready', value: data.courtReadiness?.courtReady || 0 },
                      { name: 'Weak', value: data.courtReadiness?.weak || 0 },
                      { name: 'Pending', value: data.courtReadiness?.pending || 0 }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100} 
                    dataKey="value" 
                    label
                  >
                    <Cell fill={COLORS_STATUS[0]} />
                    <Cell fill={COLORS_STATUS[1]} />
                    <Cell fill={COLORS_STATUS[2]} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'Officer':
        return (
          <div className="analytics-card">
            <h3>{getChartTitle()}</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeklyUploads || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#0f3460" fill="#4a6fa5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'Analyst':
        return (
          <div className="analytics-card">
            <h3>{getChartTitle()}</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.evidencePerCase || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="caseNumber" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f3460" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {/* System Name Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)',
            padding: '20px 28px',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 20px rgba(15, 52, 96, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faLink} style={{ fontSize: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ 
              color: 'white', 
              margin: 0, 
              fontSize: '20px', 
              fontWeight: '700',
              letterSpacing: '0.5px'
            }}>
              Criminal Evidence Chain Of Custody Management using Blockchain
            </h1>
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.7)', 
              margin: '4px 0 0 0', 
              fontSize: '14px'
            }}>
              <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '8px' }} />
              Blockchain Evidence Management System
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
            <span style={{
              padding: '6px 12px',
              background: 'rgba(72, 187, 120, 0.2)',
              borderRadius: '20px',
              color: '#48bb78',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '4px' }} />
              Blockchain Secured
            </span>
            <span style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              <FontAwesomeIcon icon={faUser} style={{ marginRight: '4px' }} />
              {user?.role}
            </span>
          </div>
        </motion.div>

        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back, ${user?.username} (${user?.role})`}
          icon={faChartBar}
        />

        {/* Stat Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
          {statCards.map((card, index) => (
            <StatCard
              key={index}
              icon={card.icon}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              color={card.color}
              onClick={card.onClick}
            />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="dashboard-grid-analytics">
          {/* Crime vs Cases Chart - Only for SuperAdmin and StationAdmin */}
          {(user?.role === 'SuperAdmin' || user?.role === 'StationAdmin') && data?.crimeVsCases && data.crimeVsCases.length > 0 && (
            <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
              <h3>
                <FontAwesomeIcon icon={faGavel} style={{ marginRight: '8px', color: '#0f3460' }} />
                Crime vs Cases
              </h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.crimeVsCases}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="cases" 
                      name="Cases" 
                      fill="#0f3460" 
                      barSize={30}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="crimes" 
                      name="Crimes" 
                      stroke="#48bb78" 
                      strokeWidth={3}
                      dot={{ r: 6, fill: '#48bb78', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: '#f7fafc', 
                borderRadius: '6px',
                fontSize: '13px',
                color: '#4a5568',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span>📊 <strong>Total Crimes:</strong> {data.crimeCount || 0}</span>
                <span>📂 <strong>Total Cases:</strong> {data.caseCount || 0}</span>
                <span>📈 <strong>Crime/Case Ratio:</strong> {data.crimeCount > 0 ? (data.caseCount / data.crimeCount).toFixed(2) : 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Role-specific Chart */}
          {renderChart()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


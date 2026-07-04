import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CasesList from './pages/CasesList';
import EvidenceList from './pages/EvidenceList';
import UploadEvidence from './pages/UploadEvidence';
import CreateCrime from './pages/CreateCrime';
import CreateCase from './pages/CreateCase';
import UsersList from './pages/UsersList';
import AddUser from './pages/AddUser';
import AddStation from './pages/AddStation';
import StationsList from './pages/StationsList';
import AuditLogs from './pages/AuditLogs';
import AssignCase from './pages/AssignCase';
import AssignAnalyst from './pages/AssignAnalyst';
import ChainOfCustodyReport from './pages/ChainOfCustodyReport';
import UploadSupportingEvidence from './pages/UploadSupportingEvidence';
import SupportingEvidenceList from './pages/SupportingEvidenceList';
import ChangePassword from './pages/ChangePassword';
import FileVerificationPage from './pages/FileVerificationPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import CloseCaseWithReport from './pages/CloseCaseWithReport';
import ClosedCasesReports from './pages/ClosedCasesReports';
import ToastNotifications from './components/ToastNotifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import './App.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading, mustChangePassword } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />;
  }
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" />;
  }
  return children;
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <ToastNotifications />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            
            {/* General Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/cases" element={<ProtectedRoute><CasesList /></ProtectedRoute>} />
            <Route path="/evidence" element={<ProtectedRoute><EvidenceList /></ProtectedRoute>} />
            <Route path="/supporting-evidence" element={<ProtectedRoute allowedRoles={['Analyst', 'SuperAdmin', 'StationAdmin', 'Officer', 'Prosecutor']}><SupportingEvidenceList /></ProtectedRoute>} />
            
            {/* Analytics Route */}
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><AnalyticsDashboard /></ProtectedRoute>} />
            
            {/* Evidence Routes */}
            <Route path="/report/:id" element={<ProtectedRoute><ChainOfCustodyReport /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><ChainOfCustodyReport /></ProtectedRoute>} />
            <Route path="/verify/:id" element={<ProtectedRoute><FileVerificationPage /></ProtectedRoute>} />
            
            {/* Close Case with Report Route */}
            <Route path="/close-case/:id" element={<ProtectedRoute allowedRoles={['Prosecutor']}><CloseCaseWithReport /></ProtectedRoute>} />
            
            {/* Closed Cases Reports Route */}
            <Route path="/closed-cases" element={<ProtectedRoute><ClosedCasesReports /></ProtectedRoute>} />
            
            {/* SuperAdmin Routes */}
            <Route path="/stations" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><StationsList /></ProtectedRoute>} />
            <Route path="/add-station" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><AddStation /></ProtectedRoute>} />
            
            {/* Admin Routes (SuperAdmin + StationAdmin) */}
            <Route path="/users" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><UsersList /></ProtectedRoute>} />
            <Route path="/add-user" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><AddUser /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/assign-case" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><AssignCase /></ProtectedRoute>} />
            <Route path="/assign-analyst" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'StationAdmin']}><AssignAnalyst /></ProtectedRoute>} />
            
            {/* Officer Only Routes */}
            <Route path="/create-crime" element={<ProtectedRoute allowedRoles={['Officer']}><CreateCrime /></ProtectedRoute>} />
            <Route path="/create-case" element={<ProtectedRoute allowedRoles={['Officer']}><CreateCase /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute allowedRoles={['Officer']}><UploadEvidence /></ProtectedRoute>} />
            
            {/* Analyst Routes */}
            <Route path="/upload-supporting" element={<ProtectedRoute allowedRoles={['Analyst']}><UploadSupportingEvidence /></ProtectedRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
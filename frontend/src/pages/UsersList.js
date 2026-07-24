import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { showSuccess, showError } from '../components/ToastNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, faUserPlus, faSearch, faFilter,
  faToggleOn, faToggleOff, faKey, faUser,
  faBuilding, faCheckCircle, faExclamationCircle,
  faShieldAlt, faUserTie, faMicroscope, faGavel
} from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogAction, setDialogAction] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const limit = 10;

  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'SuperAdmin' && user?.role !== 'StationAdmin') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, navigate, currentPage, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let usersData = [];
      if (Array.isArray(response.data)) {
        usersData = response.data;
      } else if (response.data && response.data.data !== undefined) {
        usersData = response.data.data;
      }
      
      let filteredUsers = usersData;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredUsers = filteredUsers.filter(u => 
          (u.username && u.username.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
        );
      }
      if (roleFilter) {
        filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
      }
      filteredUsers = filteredUsers.filter(u => u.address !== user?.address);
      
      setUsers(filteredUsers);
      setTotalItems(filteredUsers.length);
      setTotalPages(Math.ceil(filteredUsers.length / limit));
    } catch (err) {
      console.error('Fetch Users Error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Failed to load users');
        showError(err.response?.data?.error || 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (userItem) => {
    setSelectedUser(userItem);
    setDialogAction(userItem.isActive ? 'disable' : 'enable');
    setIsDialogOpen(true);
  };

  const confirmStatusToggle = async () => {
    if (!selectedUser) return;
    
    try {
      await axios.put(`http://localhost:5000/api/admin/users/${selectedUser.address}/status`, 
        { isActive: !selectedUser.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const action = selectedUser.isActive ? 'disabled' : 'enabled';
      showSuccess(`User "${selectedUser.username}" ${action} successfully!`);
      setIsDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleResetPassword = async (userAddress, username) => {
    if (!window.confirm(`Are you sure you want to reset the password for ${username}?`)) {
      return;
    }
    try {
      const response = await axios.post(`http://localhost:5000/api/admin/users/${userAddress}/reset-password`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(`Password reset for ${username}. New temporary password has been sent.`);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleRoleFilter = (e) => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'SuperAdmin': return <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#e53e3e' }} />;
      case 'StationAdmin': return <FontAwesomeIcon icon={faUserTie} style={{ color: '#f59e0b' }} />;
      case 'Officer': return <FontAwesomeIcon icon={faGavel} style={{ color: '#3b82f6' }} />;
      case 'Prosecutor': return <FontAwesomeIcon icon={faUser} style={{ color: '#8b5cf6' }} />;
      case 'Analyst': return <FontAwesomeIcon icon={faMicroscope} style={{ color: '#10b981' }} />;
      default: return <FontAwesomeIcon icon={faUser} style={{ color: '#718096' }} />;
    }
  };

  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedUsers = users.slice(startIndex, endIndex);

  if (loading) return <LoadingSpinner message="Loading users..." fullPage />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader
          title="User Management"
          subtitle={`${user?.role === 'SuperAdmin' ? 'Manage all users across all stations' : `Manage users in your station (${user?.stationId || 'Unknown'})`} (${totalItems} total)`}
          icon={faUsers}
          actions={
            <button 
              onClick={() => navigate('/add-user')}
              className="btn-primary"
            >
              <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: '8px' }} />
              Add User
            </button>
          }
        />

        {/* Search & Filter Bar */}
        <div className="enhanced-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '12px', color: '#a0aec0' }} />
              <input 
                type="text" 
                placeholder="Search by username or email..." 
                value={searchTerm} 
                onChange={handleSearch}
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
            <select 
              value={roleFilter} 
              onChange={handleRoleFilter}
              style={{ 
                padding: '10px 15px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                fontSize: '14px',
                minWidth: '120px',
                outline: 'none',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="StationAdmin">StationAdmin</option>
              <option value="Officer">Officer</option>
              <option value="Prosecutor">Prosecutor</option>
              <option value="Analyst">Analyst</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="evidence-table-container">
          <table className="evidence-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Station</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.address}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#4a6fa5',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <strong>{u.username}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="role-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getRoleIcon(u.role)}
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <FontAwesomeIcon icon={faBuilding} style={{ marginRight: '4px', color: '#718096' }} />
                      {u.stationId || 'N/A'}
                    </td>
                    <td>
                      <span className={u.isActive ? 'status-active' : 'status-disabled'}>
                        {u.isActive ? '✅ Active' : '🚫 Disabled'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {u.role !== 'SuperAdmin' && u.role !== 'StationAdmin' && (
                          <button 
                            onClick={() => handleToggleStatus(u)}
                            className={u.isActive ? 'btn-danger' : 'btn-success'}
                            style={{ padding: '5px 12px', fontSize: '12px' }}
                          >
                            <FontAwesomeIcon icon={u.isActive ? faToggleOff : faToggleOn} style={{ marginRight: '4px' }} />
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                        )}
                        <button 
                          onClick={() => handleResetPassword(u.address, u.username)}
                          className="btn-primary"
                          style={{ padding: '5px 12px', fontSize: '12px' }}
                        >
                          <FontAwesomeIcon icon={faKey} style={{ marginRight: '4px' }} />
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} users
          </div>
          <div className="pagination-controls">
            <button 
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedUser(null);
          }}
          onConfirm={confirmStatusToggle}
          title={dialogAction === 'disable' ? 'Disable User' : 'Enable User'}
          message={`Are you sure you want to ${dialogAction} user "${selectedUser?.username}"?`}
          confirmText={dialogAction === 'disable' ? 'Disable' : 'Enable'}
          cancelText="Cancel"
          variant={dialogAction === 'disable' ? 'danger' : 'success'}
        />
      </div>
    </div>
  );
};

export default UsersList;


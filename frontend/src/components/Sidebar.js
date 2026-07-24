import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLink, faHome, faFolder, faFile, faFileAlt, 
  faBuilding, faPlusCircle, faUsers, faUserPlus, 
  faHistory, faClipboardList, faMicroscope, 
  faUserShield, faUserTie, faUserCog, 
  faSignOutAlt, faChevronLeft, faChevronRight,
  faChevronUp, faChevronDown,
  faStar, faBalanceScale, faFileUpload,
  faQuestionCircle, faBars, faExpand, faCompress,
  faChartBar, faLock
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import '../App.css';

const Sidebar = () => {
  const { user, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stationName, setStationName] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isStationAdmin = user?.role === 'StationAdmin';
  const isOfficer = user?.role === 'Officer';
  const isAnalyst = user?.role === 'Analyst';
  const isProsecutor = user?.role === 'Prosecutor';

  // Fetch station name
  useEffect(() => {
    if (token && (isStationAdmin || isOfficer || isAnalyst || isProsecutor)) {
      axios.get('http://localhost:5000/api/admin/station-name', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setStationName(res.data.stationName || '');
      }).catch(err => {
        console.error('Failed to fetch station name');
      });
    }
  }, [token, user]);

  // Menu items configuration
  const menuItems = {
    general: {
      label: 'General',
      icon: faStar,
      items: [
        { path: '/', label: 'Dashboard', icon: faHome, description: 'Overview and statistics' },
        { path: '/cases', label: 'Cases', icon: faFolder, description: 'Manage investigation cases' },
        { path: '/evidence', label: 'Evidence', icon: faFile, description: 'Evidence records and files' },
        { path: '/supporting-evidence', label: 'Supporting Files', icon: faFileAlt, description: 'Supporting evidence documents' },
        // Analytics - Only for SuperAdmin and StationAdmin
        ...((isSuperAdmin || isStationAdmin) ? [
          { path: '/analytics', label: 'Analytics', icon: faChartBar, description: 'Advanced analytics dashboard' }
        ] : []),
        // Closed Cases - All authenticated users
        { path: '/closed-cases', label: 'Closed Cases', icon: faLock, description: 'View closed cases and reports' }
      ]
    },
    superAdmin: {
      label: 'Administration',
      icon: faUserShield,
      items: [
        { path: '/stations', label: 'Stations', icon: faBuilding, description: 'Manage police stations' },
        { path: '/add-station', label: 'Add Station', icon: faPlusCircle, description: 'Create new station' },
        { path: '/users', label: 'Users', icon: faUsers, description: 'Manage system users' },
        { path: '/add-user', label: 'Add User', icon: faUserPlus, description: 'Create new user' }
        // Removed: Audit Logs, Assign Case, Assign Analyst
      ]
    },
    stationAdmin: {
      label: 'Station Admin',
      icon: faUserCog,
      items: [
        { path: '/users', label: 'Users', icon: faUsers, description: 'Manage station users' },
        { path: '/add-user', label: 'Add User', icon: faUserPlus, description: 'Create new user' },
        { path: '/audit-logs', label: 'Audit Logs', icon: faHistory, description: 'Blockchain audit trail' },
        { path: '/assign-case', label: 'Assign Case', icon: faClipboardList, description: 'Assign cases to prosecutors' },
        { path: '/assign-analyst', label: 'Assign Analyst', icon: faMicroscope, description: 'Assign analysts to cases' }
      ]
    },
    officer: {
      label: 'Operations',
      icon: faUserTie,
      items: [
        { path: '/create-crime', label: 'New Crime', icon: faBalanceScale, description: 'Register new crime type' },
        { path: '/create-case', label: 'New Case', icon: faFolder, description: 'Create investigation case' },
        { path: '/upload', label: 'Upload Evidence', icon: faFileUpload, description: 'Upload evidence to blockchain' }
      ]
    },
    analyst: {
      label: 'Analysis',
      icon: faMicroscope,
      items: [
        { path: '/upload-supporting', label: 'Upload Report', icon: faFileUpload, description: 'Upload supporting evidence' }
      ]
    }
  };

  const renderMenuItems = (sectionKey, section) => {
    if (!section.items || section.items.length === 0) return null;
    
    const isExpanded = expandedSections[sectionKey] !== false;
    
    return (
      <div key={sectionKey} className="sidebar-section">
        <div 
          className={`sidebar-section-header ${isExpanded ? 'expanded' : ''}`}
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="sidebar-section-label">
            <FontAwesomeIcon icon={section.icon} className="section-icon" />
            <span>{section.label}</span>
          </div>
          <FontAwesomeIcon 
            icon={isExpanded ? faChevronUp : faChevronDown} 
            className="section-toggle"
          />
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="sidebar-section-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {section.items.map((item) => (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={`sidebar-link ${isActive(item.path)}`}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <motion.div
                    animate={{
                      x: hoveredItem === item.path ? 4 : 0
                    }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="sidebar-link-content"
                  >
                    <FontAwesomeIcon icon={item.icon} className="icon" />
                    <div className="link-text">
                      <span className="link-label">{item.label}</span>
                      {!isMinimized && (
                        <span className="link-description">{item.description}</span>
                      )}
                    </div>
                    {isActive(item.path) && (
                      <motion.div 
                        className="active-indicator"
                        layoutId="activeIndicator"
                        transition={{ type: 'spring', stiffness: 300 }}
                      />
                    )}
                  </motion.div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Get available sections based on user role
  const getAvailableSections = () => {
    const sections = {};
    
    // SuperAdmin gets ONLY the Administration section - no General section
    if (isSuperAdmin) {
      sections.superAdmin = menuItems.superAdmin;
    }
    
    // All other roles get the General section plus their role-specific sections
    if (!isSuperAdmin) {
      sections.general = menuItems.general;
      
      if (isStationAdmin) sections.stationAdmin = menuItems.stationAdmin;
      if (isOfficer) sections.officer = menuItems.officer;
      if (isAnalyst) sections.analyst = menuItems.analyst;
    }
    
    return sections;
  };

  const availableSections = getAvailableSections();

  return (
    <motion.div 
      className={`sidebar ${isMinimized ? 'sidebar-minimized' : ''}`}
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Toggle Button */}
      <motion.button 
        onClick={toggleSidebar}
        className="sidebar-toggle"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={isMinimized ? 'Expand sidebar (Ctrl+B)' : 'Minimize sidebar (Ctrl+B)'}
      >
        <FontAwesomeIcon icon={isMinimized ? faExpand : faCompress} />
        <span className="toggle-tooltip">
          {isMinimized ? 'Expand' : 'Minimize'}
        </span>
      </motion.button>

      {/* Brand Logo */}
      <Link to="/" className="sidebar-brand">
        <div className="brand-logo">
          <FontAwesomeIcon icon={faLink} className="brand-icon" />
        </div>
        <AnimatePresence>
          {!isMinimized ? (
            <motion.div 
              className="brand-text"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
            >
              <span className="brand-title">Criminal Evidence Chain Of Custody Management using Blockchain</span>
              <span className="brand-subtitle">Blockchain Evidence Management System</span>
            </motion.div>
          ) : (
            <motion.div 
              className="brand-text-minimized"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              title="Criminal Evidence Chain Of Custody Management using Blockchain"
            >
              <span className="brand-title-short">Chain of Custody</span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {/* Station Badge */}
      {stationName && !isMinimized && (
        <motion.div 
          className="station-badge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <FontAwesomeIcon icon={faBuilding} className="station-icon" />
          <span className="station-name">{stationName}</span>
          <span className="station-status">● Active</span>
        </motion.div>
      )}

      {/* Scrollable Menu */}
      <div className="sidebar-menu">
        {Object.entries(availableSections).map(([key, section]) => 
          renderMenuItems(key, section)
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar-wrapper">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-status-dot"></div>
          </div>
          <AnimatePresence>
            {!isMinimized && (
              <motion.div 
                className="user-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="user-name">{user?.username}</span>
                <span className="user-role">
                  <FontAwesomeIcon icon={faUserShield} style={{ marginRight: '4px', fontSize: '10px' }} />
                  {user?.role}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="sidebar-actions">
          <motion.button 
            onClick={() => navigate('/help')}
            className="sidebar-action-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Help"
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </motion.button>
          
          <motion.button 
            onClick={handleLogout} 
            className="sidebar-logout"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Logout"
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <AnimatePresence>
              {!isMinimized && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;

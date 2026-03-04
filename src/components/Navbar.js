import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, isSuperAdmin, isDoctor, isAssistant, isAnyAdmin } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

const ROLE_BADGE = {
  superadmin: { label: 'SUPER ADMIN', color: '#f59e0b' },
  admin:      { label: 'SUPER ADMIN', color: '#f59e0b' },
  doctor:     { label: 'DOCTOR',      color: '#6366f1' },
  assistant:  { label: 'ASSISTANT',   color: '#22c55e' },
};

const NAV_CONFIG = {
  student: {
    primary: [
      { to: '/dashboard',   label: 'Dashboard',   icon: '🏠', k: 'dashboard'   },
      { to: '/courses',     label: 'Courses',     icon: '📚', k: 'courses'     },
      { to: '/assignments', label: 'Assignments', icon: '📝', k: 'assignments' },
      { to: '/schedule',    label: 'Schedule',    icon: '📅', k: 'schedule'    },
      { to: '/materials',   label: 'Materials',   icon: '📄', k: 'materials'   },
      { to: '/grades',      label: 'Grades',      icon: '📊', k: 'grades'      },
    ],
    secondary: [],
  },
  superadmin: {
    primary: [
      { to: '/admin/dashboard',      label: 'Dashboard', icon: '📊', k: 'dashboard'    },
      { to: '/admin/view-students',  label: 'Students',  icon: '👨‍🎓', k: 'students' },
      { to: '/admin/manage-grades',  label: 'Grades',    icon: '📝', k: 'manageGrades' },
      { to: '/admin/view-materials', label: 'Materials', icon: '📚', k: 'viewMaterials'},
      { to: '/admin/schedule',       label: 'Schedule',  icon: '📅', k: 'schedule'     },
    ],
    secondary: [
      { to: '/admin/assignments',      label: 'Assignments',          icon: '📝', k: 'assignments'         },
      { to: '/admin/schedule-config',  label: 'Schedule Config',      icon: '⚙️', k: 'scheduleConfig'      },
      { to: '/admin/create-course',    label: 'Create Course',        icon: '➕', k: 'createCourse'        },
      { to: '/admin/upload-material',  label: 'Upload Material',      icon: '📤', k: 'uploadMaterial'      },
      { to: '/admin/grade-statistics', label: 'Grade Statistics',     icon: '📈', k: 'gradeStatistics'     },
      { to: '/admin/registration',     label: 'Registration Periods', icon: '🗓️', k: 'registrationPeriods' },
      { to: '/admin/import-pdf',       label: 'Import PDF',           icon: '📥', k: 'importPDF'           },
      { to: '/admin/staff',            label: 'Manage Staff',         icon: '⚙️', k: 'manageStaff', highlight: true },
    ],
  },
  doctor: {
    primary: [
      { to: '/admin/dashboard',      label: 'Dashboard', icon: '📊', k: 'dashboard'    },
      { to: '/admin/view-students',  label: 'Students',  icon: '👨‍🎓', k: 'students' },
      { to: '/admin/manage-grades',  label: 'Grades',    icon: '📝', k: 'manageGrades' },
      { to: '/admin/view-materials', label: 'Materials', icon: '📚', k: 'viewMaterials'},
      { to: '/admin/schedule',       label: 'Schedule',  icon: '📅', k: 'schedule'     },
    ],
    secondary: [
      { to: '/admin/assignments',      label: 'Assignments',      icon: '📝', k: 'assignments'     },
      { to: '/admin/grade-statistics', label: 'Grade Statistics', icon: '📈', k: 'gradeStatistics' },
      { to: '/admin/upload-material',  label: 'Upload Material',  icon: '📤', k: 'uploadMaterial'  },
      { to: '/admin/import-pdf',       label: 'Import PDF',       icon: '📥', k: 'importPDF'       },
    ],
  },
  assistant: {
    primary: [
      { to: '/admin/dashboard',      label: 'Dashboard', icon: '📊', k: 'dashboard'    },
      { to: '/admin/view-students',  label: 'Students',  icon: '👨‍🎓', k: 'students' },
      { to: '/admin/manage-grades',  label: 'Grades',    icon: '📝', k: 'manageGrades' },
      { to: '/admin/view-materials', label: 'Materials', icon: '📚', k: 'viewMaterials'},
      { to: '/admin/schedule',       label: 'Schedule',  icon: '📅', k: 'schedule'     },
    ],
    secondary: [
      { to: '/admin/assignments',      label: 'Assignments',      icon: '📝', k: 'assignments'     },
      { to: '/admin/grade-statistics', label: 'Grade Statistics', icon: '📈', k: 'gradeStatistics' },
      { to: '/admin/upload-material',  label: 'Upload Material',  icon: '📤', k: 'uploadMaterial'  },
      { to: '/admin/import-pdf',       label: 'Import PDF',       icon: '📥', k: 'importPDF'       },
    ],
  },
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [moreOpen,    setMoreOpen]    = useState(false);
  const [moreTabOpen, setMoreTabOpen] = useState(false);
  const moreDesktopRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (moreDesktopRef.current && !moreDesktopRef.current.contains(e.target))
        setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setMoreTabOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => { logout(); navigate('/login'); }, [logout, navigate]);
  const closeMoreTab = useCallback(() => setMoreTabOpen(false), []);

  if (!user) return null;

  const role     = isSuperAdmin(user) ? 'superadmin' : isDoctor(user) ? 'doctor' : isAssistant(user) ? 'assistant' : 'student';
  const navCfg   = NAV_CONFIG[role] || NAV_CONFIG.student;
  const anyAdmin = isAnyAdmin(user);
  const badge    = ROLE_BADGE[user.role];
  const isActive = (to) => location.pathname === to ||
    (to !== '/dashboard' && to !== '/admin/dashboard' && location.pathname.startsWith(to));

  return (
    <>
      {/* ── Top navbar ── */}
      <nav className="navbar">
        <div className="navbar-container">

          <Link to={anyAdmin ? '/admin/dashboard' : '/dashboard'} className="navbar-logo">
            <img src="/logo.jpg" alt="HNU" className="navbar-logo-img" />
            <span>HNU</span>
          </Link>

          <div className="navbar-links">
            {navCfg.primary.map(item => (
              <Link key={item.to} to={item.to}
                data-tour={`nav-${item.k}`}
                className={`nav-link ${isActive(item.to) ? 'active' : ''}`}>
                <span className="nav-link-icon">{item.icon}</span>
                <span className="nav-link-label">{t(`nav.${item.k}`) || item.label}</span>
              </Link>
            ))}
            {navCfg.secondary.length > 0 && (
              <div className="more-dropdown" ref={moreDesktopRef}>
                <button
                  data-tour="nav-more"
                  className={`nav-link more-trigger ${navCfg.secondary.some(s => isActive(s.to)) ? 'active' : ''}`}
                  onClick={() => setMoreOpen(o => !o)}
                >
                  <span className="nav-link-icon">⋯</span>
                  <span className="nav-link-label">{t('nav.more') || 'More'}</span>
                  <span className={`more-arrow ${moreOpen ? 'open' : ''}`}>▾</span>
                </button>
                {moreOpen && (
                  <div className="more-menu">
                    {navCfg.secondary.map(item => (
                      <Link
                        key={item.to} to={item.to}
                        className={`more-item ${item.highlight ? 'more-item--highlight' : ''} ${isActive(item.to) ? 'more-item--active' : ''}`}
                        onClick={() => setMoreOpen(false)}
                      >
                        <span>{item.icon}</span>
                        <span>{t(`nav.${item.k}`) || item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="navbar-right">
            <button className="btn-tour-help" title="Launch Tour" onClick={() => { if(window.__startTour) window.__startTour(); }}>❓</button>
            <button className="btn-theme-toggle" onClick={toggleDarkMode}>{darkMode ? '☀️' : '🌙'}</button>
            <button className="btn-lang-toggle" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
              {language === 'en' ? 'عربي' : 'EN'}
            </button>
            <NotificationBell />
            <div className="navbar-profile">
              <div className="navbar-avatar">
                {(user.firstName?.[0] || '?')}{(user.lastName?.[0] || '')}
              </div>
              <div className="navbar-name-wrap">
                {anyAdmin
                  ? <span className="navbar-name">{user.firstName} {user.lastName}</span>
                  : <Link to="/profile" className="navbar-name navbar-name--link">{user.firstName} {user.lastName}</Link>
                }
                {badge && (
                  <span className="role-badge" style={{ color: badge.color, borderColor: badge.color + '55', background: badge.color + '18' }}>
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>{t('nav.logout') || 'Logout'}</button>
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobile) — separate from nav so no stacking context issues ── */}
      <div className="bottom-tab-bar">
        {navCfg.primary.map(item => (
          <Link key={item.to} to={item.to} className={`bottom-tab ${isActive(item.to) ? 'active' : ''}`}>
            <span className="bottom-tab-icon">{item.icon}</span>
            <span className="bottom-tab-label">{t(`nav.${item.k}`) || item.label}</span>
          </Link>
        ))}
        <button
          className={`bottom-tab ${moreTabOpen ? 'active' : ''}`}
          onClick={() => setMoreTabOpen(o => !o)}
        >
          <span className="bottom-tab-icon">⋯</span>
          <span className="bottom-tab-label">{t('nav.more') || 'More'}</span>
        </button>
      </div>

      {/* ── Mobile more popup — sibling of nav, never inside it ── */}
      {moreTabOpen && (
        <>
          {/* Overlay — tap to close */}
          <div className="mob-overlay" onClick={closeMoreTab} />

          {/* Popup */}
          <div className="mob-popup">
            {navCfg.secondary.map(item => (
              <Link
                key={item.to} to={item.to}
                className={`mob-item ${item.highlight ? 'mob-item--hl' : ''} ${isActive(item.to) ? 'mob-item--active' : ''}`}
                onClick={closeMoreTab}
              >
                <span className="mob-icon">{item.icon}</span>
                <span>{t(`nav.${item.k}`) || item.label}</span>
              </Link>
            ))}

            {navCfg.secondary.length > 0 && <div className="mob-divider" />}

            {!anyAdmin && (
              <Link to="/profile" className="mob-item" onClick={closeMoreTab}>
                <span className="mob-icon">👤</span>
                <span>{t('nav.profile') || 'Profile'}</span>
              </Link>
            )}

            <Link to="/help" className="mob-item" onClick={closeMoreTab}>
              <span className="mob-icon">❓</span>
              <span>Help & Guide</span>
            </Link>

            <button className="mob-item" onClick={() => { toggleDarkMode(); closeMoreTab(); }}>
              <span className="mob-icon">{darkMode ? '☀️' : '🌙'}</span>
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button className="mob-item" onClick={() => { setLanguage(language === 'en' ? 'ar' : 'en'); closeMoreTab(); }}>
              <span className="mob-icon">🌐</span>
              <span>{language === 'en' ? 'عربي' : 'English'}</span>
            </button>

            <button className="mob-item mob-item--logout" onClick={handleLogout}>
              <span className="mob-icon">🚪</span>
              <span>{t('nav.logout') || 'Logout'}</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;


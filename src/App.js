/**
 * University Portal System - Main Application Component
 *
 * Copyright (c) 2026 Mazen Hossam. All Rights Reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @author Mazen Hossam <Zikas1208h@gmail.com>
 * @file Main React application component
 * @version 1.0.0
 */

import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, isAnyAdmin, isSuperAdmin, isDoctor, isAssistant } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Tour, { shouldAutoLaunchTour } from './components/Tour';
import SetupCredentials from './components/SetupCredentials';
import { Analytics } from '@vercel/analytics/react';
// Lazy-load Analytics so it never blocks initial render
const LazyAnalytics = lazy(() =>
  new Promise(resolve => setTimeout(() => resolve(import('@vercel/analytics/react').then(m => ({ default: m.Analytics }))), 3000))
);
import './App.css';

// ── Error Boundary — prevents full blank screen on runtime errors ──────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:24, textAlign:'center' }}>
        <span style={{ fontSize:48 }}>⚠️</span>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Something went wrong</h2>
        <p style={{ color:'#6b7280', fontSize:14 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding:'10px 24px', background:'#6366f1', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:14 }}>
            🔄 Try Again
          </button>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.history.back(); }}
            style={{ padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:14 }}>
            ← Go Back
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// Wrap a route element in a per-page ErrorBoundary
const Safe = ({ children }) => <ErrorBoundary>{children}</ErrorBoundary>;

// ── Retry lazy load on chunk failure ──────────────────────
const lazyWithRetry = (factory) => lazy(() => factory());

// Lazy load components for code splitting
const Login          = lazyWithRetry(() => import('./pages/Login'));
const Help           = lazyWithRetry(() => import('./pages/Help'));
const Register       = lazyWithRetry(() => import('./pages/Register'));
const Dashboard      = lazyWithRetry(() => import('./pages/Dashboard'));
const Courses        = lazyWithRetry(() => import('./pages/Courses'));
const Assignments    = lazyWithRetry(() => import('./pages/Assignments'));
const Schedule       = lazyWithRetry(() => import('./pages/Schedule'));
const Profile        = lazyWithRetry(() => import('./pages/Profile'));
const ViewMaterials  = lazyWithRetry(() => import('./pages/admin/ViewMaterials'));
const GradeStatistics  = lazyWithRetry(() => import('./pages/admin/GradeStatistics'));
const AdminDashboard   = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const CreateCourse     = lazyWithRetry(() => import('./pages/admin/CreateCourse'));
const UploadMaterial   = lazyWithRetry(() => import('./pages/admin/UploadMaterial'));
const ManageGrades     = lazyWithRetry(() => import('./pages/admin/ManageGrades'));
const ViewStudents     = lazyWithRetry(() => import('./pages/admin/ViewStudents'));
const StudentProfile   = lazyWithRetry(() => import('./pages/admin/StudentProfile'));
const RegistrationPeriods = lazyWithRetry(() => import('./pages/admin/RegistrationPeriods'));
const ManageStaff      = lazyWithRetry(() => import('./pages/admin/ManageStaff'));
const ManageAssignments = lazyWithRetry(() => import('./pages/admin/ManageAssignments'));
const ScheduleConfig   = lazyWithRetry(() => import('./pages/admin/ScheduleConfig'));
const ViewSchedule     = lazyWithRetry(() => import('./pages/admin/ViewSchedule'));
const ImportPDF        = lazyWithRetry(() => import('./pages/admin/ImportPDF'));

// Tiny inline spinner — doesn't block the page, just shows in the content area
const LoadingFallback = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh' }}>
    <div style={{
      width: 36, height: 36,
      border: '3px solid rgba(99,102,241,0.15)',
      borderTop: '3px solid #6366f1',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite'
    }} />
  </div>
);

// Smart root redirect — staff → /admin/dashboard, students/guests → /dashboard
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAnyAdmin(user) ? '/admin/dashboard' : '/dashboard'} replace />;
};

// Forces staff to complete credential setup before using the app
const CredentialGate = ({ children }) => {
  const { user, completeSetup } = useAuth();
  if (user?.mustChangeCredentials && isAnyAdmin(user)) {
    return <SetupCredentials user={user} onComplete={completeSetup} />;
  }
  return children;
};

// AppInner lives inside Router+AuthProvider — Tour is here so it NEVER unmounts
const AppInner = () => {
  const { user } = useAuth();
  const [tourRun, setTourRun] = useState(false);

  // Auto-launch tour on first login
  useEffect(() => {
    if (!user) return;
    const role = isSuperAdmin(user) ? 'superadmin'
      : isDoctor(user) ? 'doctor'
      : isAssistant(user) ? 'assistant'
      : 'student';
    if (shouldAutoLaunchTour(role)) {
      const t = setTimeout(() => setTourRun(true), 1200);
      return () => clearTimeout(t);
    }
  }, [user]);

  // Expose startTour globally — reset false first then true so Tour always restarts clean
  useEffect(() => {
    window.__startTour = () => {
      setTourRun(false);
      setTimeout(() => setTourRun(true), 50);
    };
    return () => { delete window.__startTour; };
  }, []);

  const handleTourFinish = useCallback(() => {
    setTourRun(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        import('./pages/Dashboard').catch(() => {});
        import('./pages/admin/AdminDashboard').catch(() => {});
        import('./pages/Courses').catch(() => {});
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <CredentialGate>
      {/* Tour lives here — above Routes — never unmounts on page navigation */}
      <Tour run={tourRun} onFinish={handleTourFinish} />
      <div className="App">
        <Navbar />
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<PrivateRoute><Safe><Dashboard /></Safe></PrivateRoute>} />
              <Route path="/courses" element={<PrivateRoute><Safe><Courses /></Safe></PrivateRoute>} />
              <Route path="/assignments" element={<PrivateRoute><Safe><Assignments /></Safe></PrivateRoute>} />
              <Route path="/schedule" element={<PrivateRoute><Safe><Schedule /></Safe></PrivateRoute>} />
              <Route path="/materials" element={<PrivateRoute><Safe><ViewMaterials /></Safe></PrivateRoute>} />
              <Route path="/grades" element={<PrivateRoute><Safe><GradeStatistics /></Safe></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Safe><Profile /></Safe></PrivateRoute>} />
              <Route path="/admin/dashboard" element={<PrivateRoute><Safe><AdminDashboard /></Safe></PrivateRoute>} />
              <Route path="/admin/create-course" element={<PrivateRoute><Safe><CreateCourse /></Safe></PrivateRoute>} />
              <Route path="/admin/upload-material" element={<PrivateRoute><Safe><UploadMaterial /></Safe></PrivateRoute>} />
              <Route path="/admin/manage-grades" element={<PrivateRoute><Safe><ManageGrades /></Safe></PrivateRoute>} />
              <Route path="/admin/view-students" element={<PrivateRoute><Safe><ViewStudents /></Safe></PrivateRoute>} />
              <Route path="/admin/view-materials" element={<PrivateRoute><Safe><ViewMaterials /></Safe></PrivateRoute>} />
              <Route path="/admin/grade-statistics" element={<PrivateRoute><Safe><GradeStatistics /></Safe></PrivateRoute>} />
              <Route path="/admin/student/:id" element={<PrivateRoute><Safe><StudentProfile /></Safe></PrivateRoute>} />
              <Route path="/admin/registration" element={<PrivateRoute><Safe><RegistrationPeriods /></Safe></PrivateRoute>} />
              <Route path="/admin/staff" element={<PrivateRoute><Safe><ManageStaff /></Safe></PrivateRoute>} />
              <Route path="/admin/assignments" element={<PrivateRoute><Safe><ManageAssignments /></Safe></PrivateRoute>} />
              <Route path="/admin/schedule-config" element={<PrivateRoute><Safe><ScheduleConfig /></Safe></PrivateRoute>} />
              <Route path="/admin/schedule" element={<PrivateRoute><Safe><ViewSchedule /></Safe></PrivateRoute>} />
              <Route path="/admin/import-pdf" element={<PrivateRoute><Safe><ImportPDF /></Safe></PrivateRoute>} />
              <Route path="/help" element={<PrivateRoute><Safe><Help /></Safe></PrivateRoute>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </CredentialGate>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <AppInner />
          </Router>
        </AuthProvider>
        <Analytics />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

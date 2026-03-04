import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isAnyAdmin, isSuperAdmin } from '../context/AuthContext';

const ADMIN_ROUTES    = ['/admin/'];
const SUPERADMIN_ROUTES = [
  '/admin/staff',
  '/admin/registration',
  '/admin/create-course',
];

// Routes that are ONLY for students — staff should be redirected to their own dashboard
const STUDENT_ONLY_ROUTES = ['/dashboard', '/courses', '/grades'];

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <p className="loading-text">Loading...</p>
    </div>
  );

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  const path = location.pathname;

  // Staff (doctor / assistant / superadmin / admin) must not see the student dashboard
  if (isAnyAdmin(user) && STUDENT_ONLY_ROUTES.some(r => path === r || path.startsWith(r + '/'))) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (SUPERADMIN_ROUTES.some(r => path.startsWith(r)) && !isSuperAdmin(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (ADMIN_ROUTES.some(r => path.startsWith(r)) && !isAnyAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;


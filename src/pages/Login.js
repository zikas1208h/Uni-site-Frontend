﻿import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, isAnyAdmin } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Login.css';

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Preloads fired AFTER login succeeds so login API gets full bandwidth
  const firePreloads = () => {
    setTimeout(() => {
      [
        import('./Dashboard'),
        import('./Courses'),
        import('./Assignments'),
        import('./Schedule'),
        import('./Profile'),
        import('./Grades'),
        import('./admin/AdminDashboard'),
        import('./admin/ViewStudents'),
        import('./admin/ManageGrades'),
        import('./admin/ViewMaterials'),
        import('./admin/ViewSchedule'),
        import('./admin/ScheduleConfig'),
        import('./admin/ManageStaff'),
        import('./admin/ManageAssignments'),
        import('./admin/GradeStatistics'),
        import('./admin/CreateCourse'),
        import('./admin/UploadMaterial'),
        import('./admin/RegistrationPeriods'),
        import('./admin/ImportPDF'),
      ].forEach(p => p.catch(() => {}));
    }, 200); // tiny delay — let navigation render first
  };

  const attemptLogin = async (credentials) => {
    const data = await login(credentials);
    firePreloads();
    navigate(isAnyAdmin(data?.user) ? '/admin/dashboard' : '/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setRetrying(false);

    try {
      await attemptLogin({ email, password });
    } catch (err) {
      const status = err.response?.status;
      const isNetworkError = !err.response; // no response = timeout / network down
      const isServerError = status === 502 || status === 503 || status === 504 || status >= 500;
      if (isNetworkError || isServerError) {
        // Auto-retry once silently
        setRetrying(true);
        try {
          await new Promise(r => setTimeout(r, 800)); // short pause before retry
          await attemptLogin({ email, password });
          return; // success on retry
        } catch (retryErr) {
          const retryStatus = retryErr.response?.status;
          if (retryStatus === 401) {
            setError(retryErr.response?.data?.message || 'Invalid credentials');
          } else if (!retryErr.response || retryStatus >= 500) {
            setError('Connection failed. The server may be starting up — please wait a moment and try again.');
          } else {
            setError(retryErr.response?.data?.message || 'Login failed');
          }
        } finally {
          setRetrying(false);
        }
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const btnLabel = () => {
    if (retrying) return (
      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span className="login-spinner" /> Retrying…
      </span>
    );
    if (loading) return (
      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span className="login-spinner" /> {t('login.loading')}
      </span>
    );
    return t('login.submit');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="login-icon">
            <img src="/logo.jpg" alt="HNU Logo" className="login-logo-img" />
          </div>
          <h2>{t('login.title')}</h2>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">{t('login.email')}</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t('login.emailPlaceholder')} autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t('login.passwordPlaceholder')} autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading || retrying} className="btn-primary">
            {btnLabel()}
          </button>
        </form>
        <p className="register-link">
          {t('login.noAccount')} <Link to="/register">{t('login.register')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

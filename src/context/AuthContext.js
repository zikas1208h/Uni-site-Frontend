import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Decode JWT payload without verifying signature (for instant UI render)
const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch { return null; }
};

// ── Cached user profile helpers ───────────────────────────────────────────────
const USER_CACHE_KEY = 'hnu_user_profile';
const getCachedUser  = () => { try { return JSON.parse(localStorage.getItem(USER_CACHE_KEY)); } catch { return null; } };
const setCachedUser  = (u)  => { try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u)); } catch {} };
const clearCachedUser = ()  => { localStorage.removeItem(USER_CACHE_KEY); };

// ── Role helpers ──────────────────────────────────────────────────────────────
export const ROLES = {
  STUDENT:    'student',
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',       // legacy alias treated as superadmin
  DOCTOR:     'doctor',
  ASSISTANT:  'assistant',
};

export const isSuperAdmin  = (u) => u?.role === 'superadmin' || u?.role === 'admin';
export const isDoctor      = (u) => u?.role === 'doctor';
export const isAssistant   = (u) => u?.role === 'assistant';
export const isAnyAdmin    = (u) => ['admin','superadmin','doctor','assistant'].includes(u?.role);
export const isStudent     = (u) => u?.role === 'student';

// Whether this staff member can access a given courseId
export const canAccessCourse = (user, courseId) => {
  if (!user || !courseId) return false;
  if (isSuperAdmin(user)) return true;
  const assigned = (user.assignedCourses || []).map(c => (c._id || c).toString());
  return assigned.includes(courseId.toString());
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [userReady, setUserReady] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      // Generous timeout — only needed if cache miss (first ever load / cleared cache)
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000));
      const res = await Promise.race([authAPI.getMe(), timeout]);
      setCachedUser(res.data);
      setUser(res.data);
      setUserReady(true);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        clearCachedUser();
        setUser(null);
      }
      // On timeout or network error — keep whatever we already showed
      setUserReady(true);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); setUserReady(true); return; }

    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 <= Date.now()) {
      localStorage.removeItem('token');
      clearCachedUser();
      setLoading(false);
      setUserReady(true);
      return;
    }

    // 1. Try cached full profile first — instant, no network
    const cached = getCachedUser();
    if (cached && cached.id) {
      setUser(cached);
      setLoading(false);
      setUserReady(true);
      // Silently refresh in background (don't block UI)
      authAPI.getMe().then(res => {
        setCachedUser(res.data);
        setUser(res.data);
      }).catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          clearCachedUser();
          setUser(null);
          setUserReady(false);
        }
      });
      return;
    }

    // 2. No cache — show decoded token instantly, fetch full data
    setUser(decoded);
    setLoading(false);
    loadUser();
  }, []); // eslint-disable-line

  // Handle 401 globally — clear session
  useEffect(() => {
    const { default: axiosInstance } = require('../services/api');
    const id = axiosInstance.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          clearCachedUser();
          setUser(null);
        }
        return Promise.reject(err);
      }
    );
    return () => axiosInstance.interceptors.response.eject(id);
  }, []); // eslint-disable-line

  const login = async (credentials) => {
    const res = await authAPI.login(credentials);
    localStorage.setItem('token', res.data.token);
    const { clearCache } = require('../services/api');
    clearCache();
    setCachedUser(res.data.user);
    setUser(res.data.user);
    setUserReady(true);
    return res.data;
  };

  // Called by SetupCredentials modal when setup is complete
  const completeSetup = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    const { clearCache } = require('../services/api');
    clearCache();
    const u = { ...newUser, mustChangeCredentials: false };
    setCachedUser(u);
    setUser(u);
    setUserReady(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    clearCachedUser();
    const { clearCache } = require('../services/api');
    clearCache();
    setUser(null);
    setUserReady(false);
  };

  const register = async (userData) => {
    const res = await authAPI.register(userData);
    return res.data;
  };

  const value = {
    user, loading, userReady, login, register, logout, completeSetup,
    isSuperAdmin: isSuperAdmin(user),
    isDoctor:     isDoctor(user),
    isAssistant:  isAssistant(user),
    isAnyAdmin:   isAnyAdmin(user),
    isStudent:    isStudent(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

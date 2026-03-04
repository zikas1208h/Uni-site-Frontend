import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './NotificationBell.css';

const TYPE_ICON = { assignment: '📝', material: '📄', grade: '🎓', announcement: '📢' };
const TYPE_COLOR = { assignment: '#6366f1', material: '#22c55e', grade: '#f59e0b', announcement: '#3b82f6' };

const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const pollRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const r = await notificationAPI.getUnreadCount();
      setUnread(r.data.count || 0);
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await notificationAPI.getAll();
      setNotifications(r.data.notifications || []);
      setUnread(r.data.unreadCount || 0);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Smart polling: 60s when tab is VISIBLE, 30 min when HIDDEN
  // For 5k students × 2 devices: visible=166 req/sec → hidden≈6 req/sec background
  useEffect(() => {
    if (!user) return;
    fetchCount();

    const VISIBLE_INTERVAL  = 60_000;        // 60 sec
    const HIDDEN_INTERVAL   = 30 * 60_000;   // 30 min

    const startPoll = () => {
      clearInterval(pollRef.current);
      const interval = document.visibilityState === 'visible' ? VISIBLE_INTERVAL : HIDDEN_INTERVAL;
      pollRef.current = setInterval(fetchCount, interval);
    };

    startPoll();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchCount(); // immediate check on focus
      startPoll(); // restart interval with correct rate
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, fetchCount]);

  const handleOpen = () => {
    setOpen(o => {
      if (!o) fetchAll();
      return !o;
    });
  };

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(p => p.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnread(p => Math.max(0, p - 1));
    } catch {}
  };

  const markAll = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(p => p.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {}
  };

  const deleteOne = async (id) => {
    try {
      await notificationAPI.delete(id);
      const wasUnread = notifications.find(n => n._id === id && !n.isRead);
      setNotifications(p => p.filter(n => n._id !== id));
      if (wasUnread) setUnread(p => Math.max(0, p - 1));
    } catch {}
  };

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Only show for students (staff get different notifications later)
  if (!user) return null;

  return (
    <div className="nb-wrap" ref={ref}>
      <button className="nb-bell" onClick={handleOpen} title="Notifications">
        🔔
        {unread > 0 && (
          <span className="nb-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          <div className="nb-header">
            <span className="nb-header-title">🔔 Notifications</span>
            {unread > 0 && (
              <button className="nb-mark-all" onClick={markAll}>Mark all read</button>
            )}
          </div>

          {loading ? (
            <div className="nb-loading">
              <div className="nb-spinner" />
              <span>Loading…</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="nb-empty">
              <span>🎉</span>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className="nb-list">
              {notifications.map(n => (
                <div
                  key={n._id}
                  className={`nb-item ${n.isRead ? '' : 'unread'}`}
                  style={{ '--type-color': TYPE_COLOR[n.type] || '#6366f1' }}
                >
                  <div className="nb-item-icon" style={{ background: (TYPE_COLOR[n.type] || '#6366f1') + '18' }}>
                    {TYPE_ICON[n.type] || '🔔'}
                  </div>
                  <div className="nb-item-body" onClick={() => !n.isRead && markRead(n._id)}>
                    <p className="nb-item-title">{n.title}</p>
                    <p className="nb-item-msg">{n.message}</p>
                    {n.course && (
                      <span className="nb-course-chip">{n.course.courseCode}</span>
                    )}
                    <span className="nb-time">{formatTime(n.createdAt)}</span>
                  </div>
                  <button className="nb-del" onClick={() => deleteOne(n._id)} title="Dismiss">✕</button>
                  {!n.isRead && <div className="nb-dot" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;



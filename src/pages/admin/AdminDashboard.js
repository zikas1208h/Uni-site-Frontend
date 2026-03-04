/**
 * HNU Portal — Admin Dashboard (role-aware: superadmin / doctor / assistant)
 * Copyright (c) 2026 Mazen Hossam. All Rights Reserved.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, isSuperAdmin, isDoctor, isAssistant } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './AdminDashboard.css';

// ═══════════════════════════════════════════════════════════
// SUPERADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════
const SuperAdminDashboard = ({ user }) => {
  const { t } = useLanguage();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.getStats();
      setData(res.data);
    } catch (e) { console.error(e); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DashLoader />;
  if (error || !data) return (
    <div className="adash">
      <div className="adash-header"><div><h1>👑 {t('adminDash.superAdminTitle')}</h1><p>{t('adminDash.welcome')}, <strong>{user.firstName}</strong>.</p></div></div>
      <div style={{ padding:'40px', textAlign:'center', color:'#ef4444' }}>
        <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('adminDash.failedLoad')}</p>
        <p style={{ color:'#64748b', marginTop:8 }}>{error || 'Unknown error'}</p>
        <button onClick={load} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 {t('gradeStats.retry')}</button>
      </div>
    </div>
  );

  const { studentCount, recentStudents, courseCounts, matCount, staffPreview, staffByRole, totalEnrollments } = data;

  return (
    <div className="adash">
      <div className="adash-header">
        <div>
          <h1>👑 {t('adminDash.superAdminTitle')}</h1>
          <p>{t('adminDash.welcome')}, <strong>{user.firstName}</strong>. {t('adminDash.universityOverview')}</p>
        </div>
        <div className="adash-header-actions">
          <Link to="/admin/create-course" className="adash-btn adash-btn--primary">+ {t('adminDash.createCourse')}</Link>
          <Link to="/admin/staff"         className="adash-btn adash-btn--gold">⚙️ {t('adminDash.manageStaff')}</Link>
        </div>
      </div>

      <div className="adash-kpi-grid">
        <KPI icon="👨‍🎓" label={t('adminDash.totalStudents')}  value={studentCount}                    color="#6366f1" link="/admin/view-students" />
        <KPI icon="📚"  label={t('adminDash.totalCourses')}   value={courseCounts.total}              color="#22c55e" link="/courses" />
        <KPI icon="🟢"  label={t('adminDash.activeCourses')}  value={courseCounts.active || 0}        color="#f59e0b" />
        <KPI icon="📝"  label={t('adminDash.enrollments')}    value={totalEnrollments}                color="#f97316" />
        <KPI icon="📄"  label={t('adminDash.materials')}      value={matCount}                        color="#ec4899" link="/admin/view-materials" />
        <KPI icon="🎓"  label={t('adminDash.doctors')}        value={staffByRole?.doctor || 0}        color="#6366f1" link="/admin/staff" />
        <KPI icon="📋"  label={t('adminDash.assistants')}     value={staffByRole?.assistant || 0}     color="#22c55e" link="/admin/staff" />
        <KPI icon="👥"  label={t('adminDash.staffTotal')}     value={Object.values(staffByRole || {}).reduce((a,b)=>a+b,0)} color="#94a3b8" link="/admin/staff" />
      </div>

      <div className="adash-section">
        <h2 className="adash-section-title">{t('adminDash.quickActions')}</h2>
        <div className="adash-actions-grid">
          <QuickAction to="/admin/view-students"    icon="👨‍🎓" label={t('adminDash.viewStudents')}       color="#6366f1" />
          <QuickAction to="/admin/assignments"      icon="📝"  label={t('adminDash.assignments')}         color="#f97316" />
          <QuickAction to="/admin/manage-grades"    icon="📝"  label={t('adminDash.manageGrades')}        color="#f59e0b" />
          <QuickAction to="/admin/view-materials"   icon="📚"  label={t('adminDash.viewMaterials')}       color="#22c55e" />
          <QuickAction to="/admin/create-course"    icon="➕"  label={t('adminDash.createCourse')}        color="#f97316" />
          <QuickAction to="/admin/upload-material"  icon="📤"  label={t('adminDash.uploadMaterial')}      color="#ec4899" />
          <QuickAction to="/admin/schedule-config"  icon="📅"  label={t('adminDash.scheduleConfig')}      color="#3b82f6" />
          <QuickAction to="/admin/grade-statistics" icon="📈"  label={t('adminDash.gradeStatistics')}     color="#6366f1" />
          <QuickAction to="/admin/registration"     icon="🗓️" label={t('adminDash.registrationPeriods')} color="#22c55e" />
          <QuickAction to="/admin/staff"            icon="⚙️"  label={t('adminDash.manageStaff')}         color="#f59e0b" gold />
        </div>
      </div>

      <div className="adash-bottom-grid">
        <div className="adash-card">
          <div className="adash-card-header">
            <h3>👨‍🎓 {t('adminDash.recentStudents')}</h3>
            <Link to="/admin/view-students">{t('adminDash.viewAll')} →</Link>
          </div>
          <div className="adash-list">
            {(recentStudents || []).map(s => (
              <Link to={`/admin/student/${s._id}`} key={s._id} className="adash-list-item">
                <div className="adash-item-avatar" style={{ background:'#6366f122', color:'#6366f1' }}>{s.firstName[0]}{s.lastName[0]}</div>
                <div className="adash-item-info">
                  <p className="adash-item-name">{s.firstName} {s.lastName}</p>
                  <p className="adash-item-sub">{s.major} · Year {s.year}</p>
                </div>
                <span className="adash-item-badge">{s.enrolledCourses?.length || 0} {t('common.courses')}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="adash-card">
          <div className="adash-card-header">
            <h3>⚙️ {t('adminDash.staff')}</h3>
            <Link to="/admin/staff">{t('adminDash.manage')} →</Link>
          </div>
          <div className="adash-list">
            {(staffPreview || []).map(s => (
              <div key={s._id} className="adash-list-item">
                <div className="adash-item-avatar" style={{ background: s.role==='doctor' ? '#6366f122':'#22c55e22', color: s.role==='doctor' ? '#6366f1':'#22c55e' }}>
                  {s.firstName?.[0]}{s.lastName?.[0]}
                </div>
                <div className="adash-item-info">
                  <p className="adash-item-name">{s.firstName} {s.lastName}</p>
                  <p className="adash-item-sub">{s.email}</p>
                </div>
                <span className="adash-item-badge" style={{ background: s.role==='doctor'?'#6366f115':s.role==='superadmin'?'#f59e0b15':'#22c55e15', color: s.role==='doctor'?'#6366f1':s.role==='superadmin'?'#f59e0b':'#22c55e' }}>
                  {s.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════
const DoctorDashboard = ({ user }) => {
  const { t } = useLanguage();
  const { userReady } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!userReady) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.getStats();
      setData(res.data);
    } catch (e) {
      console.error('Doctor dashboard error:', e);
      setError(e.response?.data?.message || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userReady]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  if (loading) return <DashLoader />;
  if (error || !data) return (
    <div className="adash">
      <div className="adash-header"><div><h1>🎓 {t('adminDash.doctorTitle')}</h1></div></div>
      <div style={{ padding:40, textAlign:'center', color:'#ef4444' }}>
        <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('adminDash.failedLoad')}</p>
        <p style={{ color:'#64748b', marginTop:8 }}>{error || 'Unknown error'}</p>
        <button onClick={load} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 {t('gradeStats.retry')}</button>
      </div>
    </div>
  );

  const myCourses   = data.myCourses   || [];
  const myStudents  = data.recentStudents || [];
  const myMatsCount = data.matCount    || 0;
  const activeCourses = myCourses.filter(c => c.status === 'active');

  return (
    <div className="adash">
      <div className="adash-header">
        <div>
          <h1>🎓 {t('adminDash.doctorTitle')}</h1>
          <p>{t('adminDash.welcome')}, <strong>Dr. {user.lastName}</strong>.</p>
        </div>
        <div className="adash-header-actions">
          <Link to="/admin/manage-grades"   className="adash-btn adash-btn--primary">📝 {t('adminDash.manageGrades')}</Link>
          <Link to="/admin/upload-material" className="adash-btn adash-btn--secondary">📤 {t('adminDash.uploadMaterial')}</Link>
        </div>
      </div>

      <div className="adash-kpi-grid">
        <KPI icon="📚" label={t('adminDash.myCourses')}   value={myCourses.length}     color="#6366f1" />
        <KPI icon="🟢" label={t('adminDash.active')}      value={activeCourses.length} color="#22c55e" />
        <KPI icon="👨‍🎓" label={t('adminDash.myStudents')} value={myStudents.length}    color="#f59e0b" />
        <KPI icon="📄" label={t('adminDash.materials')}   value={myMatsCount}          color="#ec4899" />
      </div>

      <div className="adash-section">
        <h2 className="adash-section-title">{t('adminDash.quickActions')}</h2>
        <div className="adash-actions-grid">
          <QuickAction to="/admin/view-students"    icon="👨‍🎓" label={t('adminDash.viewStudents')}   color="#6366f1" />
          <QuickAction to="/admin/assignments"      icon="📝"  label={t('adminDash.assignments')}     color="#f97316" />
          <QuickAction to="/admin/manage-grades"    icon="📝"  label={t('adminDash.manageGrades')}    color="#f59e0b" />
          <QuickAction to="/admin/view-materials"   icon="📚"  label={t('adminDash.viewMaterials')}   color="#22c55e" />
          <QuickAction to="/admin/upload-material"  icon="📤"  label={t('adminDash.uploadMaterial')}  color="#ec4899" />
          <QuickAction to="/admin/grade-statistics" icon="📈"  label={t('adminDash.gradeStatistics')} color="#6366f1" />
        </div>
      </div>

      <div className="adash-bottom-grid">
        <div className="adash-card">
          <div className="adash-card-header"><h3>📚 {t('adminDash.myCourses')}</h3></div>
          <div className="adash-list">
            {myCourses.length === 0 ? <EmptyState msg={t('adminDash.noAssignedCourses')} /> : myCourses.map(c => (
              <div key={c._id} className="adash-list-item">
                <div className="adash-item-avatar" style={{ background:'#6366f115', color:'#6366f1', fontSize:11, fontWeight:800 }}>{c.courseCode?.slice(-3)}</div>
                <div className="adash-item-info">
                  <p className="adash-item-name">{c.courseName}</p>
                  <p className="adash-item-sub">{c.courseCode} · {c.credits} cr</p>
                </div>
                <span className={`adash-status-chip ${c.status}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="adash-card">
          <div className="adash-card-header">
            <h3>👨‍🎓 {t('adminDash.myStudents')}</h3>
            <Link to="/admin/view-students">{t('adminDash.viewAll')} →</Link>
          </div>
          <div className="adash-list">
            {myStudents.length === 0 ? <EmptyState msg={t('adminDash.noStudents')} /> :
              myStudents.slice(0, 6).map(s => (
                <Link to={`/admin/student/${s._id}`} key={s._id} className="adash-list-item">
                  <div className="adash-item-avatar" style={{ background:'#f59e0b15', color:'#f59e0b' }}>{s.firstName[0]}{s.lastName[0]}</div>
                  <div className="adash-item-info">
                    <p className="adash-item-name">{s.firstName} {s.lastName}</p>
                    <p className="adash-item-sub">{s.major} · Year {s.year}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ASSISTANT DASHBOARD
// ═══════════════════════════════════════════════════════════
const AssistantDashboard = ({ user }) => {
  const { t } = useLanguage();
  const { userReady } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!userReady) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.getStats();
      setData(res.data);
    } catch (e) {
      console.error('Assistant dashboard error:', e);
      setError(e.response?.data?.message || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userReady]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  if (loading) return <DashLoader />;
  if (error || !data) return (
    <div className="adash">
      <div className="adash-header"><div><h1>📋 {t('adminDash.assistantTitle')}</h1></div></div>
      <div style={{ padding:40, textAlign:'center', color:'#ef4444' }}>
        <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('adminDash.failedLoad')}</p>
        <p style={{ color:'#64748b', marginTop:8 }}>{error || 'Unknown error'}</p>
        <button onClick={load} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 {t('gradeStats.retry')}</button>
      </div>
    </div>
  );

  const myCourses   = data.myCourses   || [];
  const myStudents  = data.recentStudents || [];
  const myMatsCount = data.matCount    || 0;

  return (
    <div className="adash">
      <div className="adash-header">
        <div>
          <h1>📋 {t('adminDash.assistantTitle')}</h1>
          <p>{t('adminDash.welcome')}, <strong>{user.firstName}</strong>.</p>
        </div>
        <div className="adash-header-actions">
          <Link to="/admin/manage-grades"   className="adash-btn adash-btn--primary">📝 {t('adminDash.manageGrades')}</Link>
          <Link to="/admin/upload-material" className="adash-btn adash-btn--secondary">📤 {t('adminDash.uploadMaterial')}</Link>
        </div>
      </div>

      <div className="adash-kpi-grid">
        <KPI icon="📚" label={t('adminDash.assignedCourses')} value={myCourses.length}  color="#22c55e" />
        <KPI icon="👨‍🎓" label={t('adminDash.myStudents')}     value={myStudents.length} color="#6366f1" />
        <KPI icon="📄" label={t('adminDash.materials')}       value={myMatsCount}       color="#f59e0b" />
      </div>

      <div className="adash-section">
        <h2 className="adash-section-title">{t('adminDash.quickActions')}</h2>
        <div className="adash-actions-grid">
          <QuickAction to="/admin/view-students"    icon="👨‍🎓" label={t('adminDash.viewStudents')}   color="#6366f1" />
          <QuickAction to="/admin/assignments"      icon="📝"  label={t('adminDash.assignments')}     color="#f97316" />
          <QuickAction to="/admin/manage-grades"    icon="📝"  label={t('adminDash.manageGrades')}    color="#f59e0b" />
          <QuickAction to="/admin/view-materials"   icon="📚"  label={t('adminDash.viewMaterials')}   color="#22c55e" />
          <QuickAction to="/admin/upload-material"  icon="📤"  label={t('adminDash.uploadMaterial')}  color="#ec4899" />
          <QuickAction to="/admin/grade-statistics" icon="📈"  label={t('adminDash.gradeStatistics')} color="#6366f1" />
        </div>
      </div>

      <div className="adash-bottom-grid">
        <div className="adash-card">
          <div className="adash-card-header"><h3>📚 {t('adminDash.assignedCourses')}</h3></div>
          <div className="adash-list">
            {myCourses.length === 0 ? <EmptyState msg={t('adminDash.noAssignedCourses')} /> : myCourses.map(c => (
              <div key={c._id} className="adash-list-item">
                <div className="adash-item-avatar" style={{ background:'#22c55e15', color:'#22c55e', fontSize:11, fontWeight:800 }}>{c.courseCode?.slice(-3)}</div>
                <div className="adash-item-info">
                  <p className="adash-item-name">{c.courseName}</p>
                  <p className="adash-item-sub">{c.courseCode} · {c.credits} cr</p>
                </div>
                <span className={`adash-status-chip ${c.status}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="adash-card">
          <div className="adash-card-header">
            <h3>👨‍🎓 {t('adminDash.myStudents')}</h3>
            <Link to="/admin/view-students">{t('adminDash.viewAll')} →</Link>
          </div>
          <div className="adash-list">
            {myStudents.length === 0 ? <EmptyState msg={t('adminDash.noStudents')} /> :
              myStudents.slice(0, 6).map(s => (
                <Link to={`/admin/student/${s._id}`} key={s._id} className="adash-list-item">
                  <div className="adash-item-avatar" style={{ background:'#6366f115', color:'#6366f1' }}>{s.firstName[0]}{s.lastName[0]}</div>
                  <div className="adash-item-info">
                    <p className="adash-item-name">{s.firstName} {s.lastName}</p>
                    <p className="adash-item-sub">{s.major} · Year {s.year}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════
const KPI = ({ icon, label, value, color, link }) => {
  const content = (
    <div className="adash-kpi" style={{ '--kpi-color': color }}>
      <div className="adash-kpi-icon">{icon}</div>
      <div>
        <p className="adash-kpi-value">{value ?? '—'}</p>
        <p className="adash-kpi-label">{label}</p>
      </div>
    </div>
  );
  return link ? <Link to={link} className="adash-kpi-link">{content}</Link> : content;
};

const QuickAction = ({ to, icon, label, color, gold }) => (
  <Link to={to} className={`adash-qa ${gold ? 'adash-qa--gold' : ''}`} style={{ '--qa-color': color }}>
    <span className="adash-qa-icon">{icon}</span>
    <span className="adash-qa-label">{label}</span>
  </Link>
);

const DashLoader = () => {
  const { t } = useLanguage();
  return (
    <div className="adash-loader">
      <div className="adash-spinner" />
      <p>{t('common.loading')}</p>
    </div>
  );
};

const EmptyState = ({ msg }) => (
  <div className="adash-empty">{msg}</div>
);

// ═══════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════
const AdminDashboard = () => {
  const { user, userReady } = useAuth();
  if (!user || !userReady) return <DashLoader />;
  if (isSuperAdmin(user))  return <SuperAdminDashboard user={user} />;
  if (isDoctor(user))      return <DoctorDashboard     user={user} />;
  if (isAssistant(user))   return <AssistantDashboard  user={user} />;
  return <SuperAdminDashboard user={user} />;
};

export default AdminDashboard;


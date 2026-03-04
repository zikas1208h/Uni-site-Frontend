import React, { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '../services/api';
import { useAuth, isAnyAdmin } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [gpaData, setGpaData] = useState({ gpa: 0, totalCredits: 0 });
  const [grades, setGrades] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [creditEligibility, setCreditEligibility] = useState(null);
  const [loading, setLoading] = useState(true);

  const gradeClass = (g) => {
    if (!g) return '';
    const map = { 'A+':'a-plus','A':'a','A-':'a-minus','B+':'b-plus','B':'b','B-':'b-minus','C+':'c-plus','C':'c','C-':'c-minus','D+':'d-plus','D':'d','D-':'d-minus','F':'f' };
    return 'grade-' + (map[g] || g.toLowerCase());
  };

  const fetchData = useCallback(async () => {
    const cacheKey = `dash:${user?._id || user?.id}`;
    // Show cached data instantly on revisit — no spinner
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const p = JSON.parse(cached);
        setGpaData(p.gpaData); setGrades(p.grades);
        setEnrolledCourses(p.enrolledCourses); setCreditEligibility(p.creditEligibility);
        setMaterials(p.materials); setLoading(false);
      }
    } catch {}
    // Single API call replaces 5 separate requests
    try {
      const res = await dashboardAPI.getStudentStats();
      const d = res.data;
      setGpaData(d.gpaData); setGrades(d.grades);
      setEnrolledCourses(d.enrolledCourses); setCreditEligibility(d.creditEligibility);
      setMaterials(d.materials);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(d)); } catch {}
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user?._id, user?.id]); // eslint-disable-line

  useEffect(() => {
    if (user && isAnyAdmin(user)) { navigate('/admin/dashboard', { replace: true }); return; }
    fetchData();
  }, [user, navigate, fetchData]); // eslint-disable-line


  if (loading) return <div className="loading">{t('dashboard.loading')}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>{t('dashboard.studentWelcome')}, {user?.firstName}! 👋</h1>
        <p className="dashboard-subtitle">{t('dashboard.academicOverview')}</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card gpa-card">
          <h3>{t('dashboard.currentCGPA')}</h3>
          <div className="stat-value">{gpaData.gpa.toFixed(2)}</div>
          <p className="stat-label">{t('dashboard.outOf')}</p>
        </div>
        <div className="stat-card">
          <h3>{t('dashboard.totalCredits')}</h3>
          <div className="stat-value">{gpaData.totalCredits}</div>
          <p className="stat-label">{t('dashboard.creditsEarned')}</p>
        </div>
        <div className="stat-card">
          <h3>{t('dashboard.enrolledCourses')}</h3>
          <div className="stat-value">{enrolledCourses.length}</div>
          <p className="stat-label">{t('dashboard.thisSemester')}</p>
        </div>
        <div className="stat-card">
          <h3>{t('dashboard.completedCourses')}</h3>
          <div className="stat-value">{grades.length}</div>
          <p className="stat-label">{t('dashboard.total')}</p>
        </div>
        {creditEligibility && (
          <div className="stat-card credit-eligibility-card">
            <h3>{t('dashboard.creditStatus')}</h3>
            <div className="credit-info">
              <div className="credit-row"><span className="credit-label">{t('dashboard.creditLimit')}:</span><span className="credit-value">{creditEligibility.creditLimit} hrs</span></div>
              <div className="credit-row"><span className="credit-label">{t('dashboard.currentEnrolled')}:</span><span className="credit-value">{creditEligibility.currentCredits} hrs</span></div>
              <div className="credit-row"><span className="credit-label">{t('dashboard.remaining')}:</span><span className="credit-value available">{creditEligibility.availableCredits} hrs</span></div>
            </div>
          </div>
        )}
      </div>
      <div className="dashboard-sections">
        <div className="section">
          <h2>📚 {t('dashboard.recentMaterials')}</h2>
          {materials.length === 0 ? <p className="empty-message">{t('dashboard.noMaterials')}</p> : (
            <div className="materials-list">
              {materials.slice(0, 5).map((m) => (
                <div key={m._id} className="material-item">
                  <div className="material-icon">{m.type==='lecture'?'📖':m.type==='video'?'🎥':m.type==='assignment'?'📝':'📄'}</div>
                  <div className="material-details">
                    <h4>{m.title}</h4>
                    <p className="material-course">{m.course?.courseCode} - {m.course?.courseName}</p>
                    <div className="material-meta"><span className="material-type">{m.type}</span><span className="material-date">{new Date(m.createdAt).toLocaleDateString()}</span></div>
                  </div>
                  <a href={`${process.env.REACT_APP_API_URL||'http://localhost:5000'}/${m.filePath}`} download className="btn-download-small" target="_blank" rel="noopener noreferrer">📥</a>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="section">
          <h2>{t('dashboard.currentCourses')}</h2>
          {enrolledCourses.length === 0 ? <p className="empty-message">{t('dashboard.noCoursesEnrolled')}</p> : (
            <div className="courses-grid">
              {enrolledCourses.map((c) => (
                <div key={c._id} className="course-card">
                  <h3>{c.courseName}</h3>
                  <p className="course-code">{c.courseCode}</p>
                  <div className="course-credits">{c.credits} {t('courses.credits')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="section">
          <h2>{t('dashboard.recentGrades')}</h2>
          {grades.length === 0 ? <p className="empty-message">{t('dashboard.noGradesYet')}</p> : (
            <div className="grades-table">
              <table>
                <thead><tr><th>{t('dashboard.courseCode')}</th><th>{t('common.code')}</th><th>{t('dashboard.grade')}</th><th>{t('common.credits')}</th><th>{t('common.semester')}</th></tr></thead>
                <tbody>
                  {grades.slice(0, 5).map((g) => (
                    <tr key={g._id}>
                      <td>{g.course.courseName}</td><td>{g.course.courseCode}</td>
                      <td><span className={`grade-badge ${gradeClass(g.grade)}`}>{g.grade}</span></td>
                      <td>{g.course.credits}</td><td>{g.semester} {g.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { gradeAPI, pageCache } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import './Grades.css';

const Grades = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [grades,   setGrades]   = useState([]);
  const [gpaData,  setGpaData]  = useState({ gpa: 0, totalCredits: 0, pendingCount: 0 });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [activeTab, setActiveTab] = useState('semester'); // 'semester' | 'classwork'

  const gradeClass = (g) => {
    if (!g) return '';
    const map = { 'A+':'a-plus','A':'a','A-':'a-minus','B+':'b-plus','B':'b','B-':'b-minus','C+':'c-plus','C':'c','C-':'c-minus','D+':'d-plus','D':'d','D-':'d-minus','F':'f' };
    return 'grade-' + (map[g] || g.toLowerCase());
  };

  const fetchGrades = useCallback(async () => {
    try {
      await pageCache(`grades:${user?._id}`, async () => {
        const [gradesRes, gpaRes] = await Promise.all([gradeAPI.getStudentGrades(), gradeAPI.getGPA()]);
        return { grades: gradesRes.data || [], gpaData: gpaRes.data || { gpa: 0, totalCredits: 0, pendingCount: 0 } };
      }, (data) => {
        setGrades(data.grades);
        setGpaData(data.gpaData);
        setLoading(false);
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load grades');
      setLoading(false);
    }
  }, [user?._id]); // eslint-disable-line

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  const groupBySemester = (list) => {
    const grouped = {};
    list.forEach(g => {
      const key = `${g.semester} ${g.year}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(g);
    });
    return grouped;
  };

  const calculateSemesterGPA = (semesterGrades) => {
    let totalPoints = 0, totalCredits = 0;
    semesterGrades.forEach(g => {
      if (!g.semesterGrade?.isFinalized) return;
      totalPoints  += g.semesterGrade.gradePoint * (g.course?.credits || 0);
      totalCredits += g.course?.credits || 0;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '—';
  };

  if (loading) return <div className="loading">{t('grades.loading')}</div>;
  if (error) return (
    <div className="grades-page">
      <div className="grades-header"><h1>{t('grades.title')}</h1></div>
      <div style={{ padding:'40px', textAlign:'center', color:'#ef4444' }}>
        <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('gradeStats.failedLoad')}</p>
        <p style={{ color:'#64748b', marginTop:8 }}>{error}</p>
        <button onClick={fetchGrades} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 Retry</button>
      </div>
    </div>
  );

  // Grades that have any semester grade data
  const semesterGrades  = grades.filter(g => g.semesterGrade?.midtermScore != null || g.semesterGrade?.finalScore != null || g.semesterGrade?.grade != null);
  // Grades that have classwork entries
  const classworkGrades = grades.filter(g => g.classwork && g.classwork.length > 0);

  const groupedSemester  = groupBySemester(semesterGrades);
  const groupedClasswork = groupBySemester(classworkGrades);

  return (
    <div className="grades-page">
      {/* ── Header with CGPA ── */}
      <div className="grades-header">
        <h1>{t('grades.title')}</h1>
        <div className="gpa-display">
          <div className="gpa-main">
            <span className="gpa-label">{t('grades.cumulativeGPA')}</span>
            <span className="gpa-value">{gpaData.gpa.toFixed(2)}</span>
            <span className="gpa-scale">/ 4.0</span>
          </div>
          <div className="gpa-info">
            <div className="info-item">
              <span className="info-label">{t('grades.totalCredits')}</span>
              <span className="info-value">{gpaData.totalCredits}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t('grades.coursesCompleted')}</span>
              <span className="info-value">{grades.filter(g => g.semesterGrade?.isFinalized).length}</span>
            </div>
          </div>
          {gpaData.pendingCount > 0 && (
            <div style={{ marginTop:12, padding:'10px 16px', borderRadius:10, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)', fontSize:13, color:'#92400e', display:'flex', alignItems:'center', gap:8 }}>
              <span>⏳</span>
              <span><strong>{gpaData.pendingCount} course{gpaData.pendingCount > 1 ? 's' : ''}</strong> {gpaData.pendingCount > 1 ? 'have' : 'has'} grades in progress — <strong>Final Exam not yet graded.</strong> Not counted in CGPA.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="grade-mode-toggle" style={{ marginBottom: 24 }}>
        <button className={`mode-btn ${activeTab === 'semester' ? 'active' : ''}`} onClick={() => setActiveTab('semester')}>
          🎓 Semester Grades <small style={{ opacity:.7 }}>(Midterm + Final · A–F · GPA)</small>
        </button>
        <button className={`mode-btn ${activeTab === 'classwork' ? 'active' : ''}`} onClick={() => setActiveTab('classwork')}>
          📝 Classwork <small style={{ opacity:.7 }}>(Assignments &amp; Quizzes · raw marks)</small>
        </button>
      </div>

      {/* ── SEMESTER GRADES TAB ── */}
      {activeTab === 'semester' && (
        Object.keys(groupedSemester).length === 0 ? (
          <div className="empty-message">No semester grades yet.</div>
        ) : (
          <div className="semesters-container">
            {Object.entries(groupedSemester).map(([sem, semGrades]) => (
              <div key={sem} className="semester-section">
                <div className="semester-header">
                  <h2>{sem}</h2>
                  <span className="semester-gpa">{t('grades.semesterGPA')}: {calculateSemesterGPA(semGrades)}</span>
                </div>
                <div className="grades-table-container">
                  <table className="grades-table">
                    <thead>
                      <tr>
                        <th>{t('common.code')}</th>
                        <th>{t('grades.course')}</th>
                        <th>{t('grades.credits')}</th>
                        <th>Midterm</th>
                        <th>Final</th>
                        <th>Total</th>
                        <th>{t('grades.grade')}</th>
                        <th>GPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semGrades.map(g => {
                        const sg = g.semesterGrade || {};
                        const finalized = sg.isFinalized;
                        return (
                          <tr key={g._id} className={`${g.isRetake ? 'retake-row' : ''} ${!finalized ? 'partial-grade-row' : ''}`}>
                            <td className="course-code-cell">{g.course?.courseCode}</td>
                            <td className="course-name-cell">
                              {g.course?.courseName}
                              {g.isRetake && <span className="retake-badge">🔁 Retake {g.previousGrade ? `(was ${g.previousGrade})` : ''}</span>}
                              {!finalized && <span className="partial-badge">⏳ Pending Final</span>}
                            </td>
                            <td className="credits-cell">{g.course?.credits}</td>
                            <td className="scores-breakdown-cell">
                              {sg.midtermScore != null
                                ? <span className="score-chip"><span className="score-chip-val">{sg.midtermScore}/{sg.midtermMaxScore || 40}</span></span>
                                : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                            </td>
                            <td className="scores-breakdown-cell">
                              {sg.finalScore != null
                                ? <span className="score-chip score-chip-final"><span className="score-chip-val">{sg.finalScore}/{sg.finalMaxScore || 60}</span></span>
                                : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                            </td>
                            <td style={{ fontWeight:700 }}>
                              {sg.totalScore != null ? `${sg.totalScore.toFixed(1)}/100` : '—'}
                            </td>
                            <td>
                              {finalized
                                ? <span className={`grade-badge ${gradeClass(sg.grade)}`}>{sg.grade}</span>
                                : <span style={{ color:'#94a3b8', fontSize:13 }}>Pending</span>}
                              {g.isRetake && sg.grade && sg.grade !== 'F' && <span className="retake-cap-note">⚠ max 83</span>}
                            </td>
                            <td className="grade-point-cell" style={!finalized ? { color:'#94a3b8' } : {}}>
                              {finalized ? sg.gradePoint?.toFixed(2) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── CLASSWORK TAB ── */}
      {activeTab === 'classwork' && (
        classworkGrades.length === 0 ? (
          <div className="empty-message">No classwork grades yet.</div>
        ) : (
          <div className="semesters-container">
            {Object.entries(groupedClasswork).map(([sem, cwGrades]) => (
              <div key={sem} className="semester-section">
                <div className="semester-header"><h2>{sem}</h2></div>
                {cwGrades.map(g => (
                  <div key={g._id} style={{ marginBottom: 20 }}>
                    <div style={{ padding:'10px 16px', background:'rgba(59,130,246,0.07)', borderRadius:'10px 10px 0 0', fontWeight:700, fontSize:14, color:'#1e40af', borderBottom:'1px solid rgba(59,130,246,0.15)' }}>
                      {g.course?.courseCode} — {g.course?.courseName}
                    </div>
                    <div className="grades-table-container" style={{ borderRadius:'0 0 10px 10px' }}>
                      <table className="grades-table">
                        <thead>
                          <tr>
                            <th>Assignment / Quiz</th>
                            <th>Type</th>
                            <th>Score</th>
                            <th>Max</th>
                            <th>%</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.classwork.map((entry, idx) => {
                            const pct = entry.isGraded && entry.score != null
                              ? ((entry.score / entry.maxScore) * 100).toFixed(1) : null;
                            return (
                              <tr key={idx}>
                                <td>{entry.name}</td>
                                <td><span className="comp-type-badge" data-type={entry.type}>{entry.type}</span></td>
                                <td style={{ fontWeight: entry.isGraded ? 700 : 400 }}>
                                  {entry.isGraded ? entry.score : <span style={{ color:'#94a3b8' }}>—</span>}
                                </td>
                                <td>{entry.maxScore}</td>
                                <td style={{ color: pct != null ? (Number(pct) >= 50 ? '#22c55e' : '#ef4444') : '#94a3b8', fontWeight:700 }}>
                                  {pct != null ? `${pct}%` : '—'}
                                </td>
                                <td>
                                  {entry.isGraded
                                    ? <span style={{ color:'#22c55e', fontSize:12, fontWeight:600 }}>✅ Graded</span>
                                    : <span style={{ color:'#94a3b8', fontSize:12 }}>⏳ Pending</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Grades;

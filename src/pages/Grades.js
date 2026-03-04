import React, { useState, useEffect, useCallback } from 'react';
import { gradeAPI, pageCache } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import './Grades.css';

const Grades = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [gpaData, setGpaData] = useState({ gpa: 0, totalCredits: 0, partialCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert "A+", "B-" → "grade-a-plus", "grade-b-minus"
  const gradeClass = (g) => {
    if (!g) return '';
    const map = { 'A+': 'a-plus', 'A': 'a', 'A-': 'a-minus', 'B+': 'b-plus', 'B': 'b', 'B-': 'b-minus', 'C+': 'c-plus', 'C': 'c', 'C-': 'c-minus', 'D+': 'd-plus', 'D': 'd', 'D-': 'd-minus', 'F': 'f' };
    return 'grade-' + (map[g] || g.toLowerCase());
  };

  const fetchGrades = useCallback(async () => {
    try {
      await pageCache(`grades:${user?._id}`, async () => {
        const [gradesRes, gpaRes] = await Promise.all([
          gradeAPI.getStudentGrades(),
          gradeAPI.getGPA(),
        ]);
        return { grades: gradesRes.data || [], gpaData: gpaRes.data || { gpa: 0, totalCredits: 0 } };
      }, (data) => {
        setGrades(data.grades);
        setGpaData(data.gpaData);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error fetching grades:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load grades');
      setLoading(false);
    }
  }, [user?._id]); // eslint-disable-line

  useEffect(() => { fetchGrades(); }, [fetchGrades]);


  const groupBySemester = (grades) => {
    const grouped = {};
    grades.forEach((grade) => {
      const key = `${grade.semester} ${grade.year}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(grade);
    });
    return grouped;
  };

  // Mirrors backend logic — handles old grades where isFinalized is undefined
  const isGradeFinalized = (grade) => {
    if (grade.isFinalized === true)  return true;
    if (grade.isFinalized === false) return false;
    // Legacy grade: inspect actual data
    const comps = grade.components || [];
    if (comps.length > 0) return comps.some(c => c.type === 'final' && c.score != null);
    if (grade.finalScore != null) return true;
    if (grade.quizScore != null || grade.assignmentScore != null) return false;
    return true; // manual grade — no scores
  };

  const calculateSemesterGPA = (semesterGrades) => {
    let totalPoints = 0;
    let totalCredits = 0;
    semesterGrades.forEach((grade) => {
      if (!isGradeFinalized(grade)) return; // partial — exclude from GPA
      totalPoints += grade.gradePoint * grade.course.credits;
      totalCredits += grade.course.credits;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '—';
  };

  if (loading) return <div className="loading">{t('grades.loading')}</div>;

  if (error) {
    return (
      <div className="grades-page">
        <div className="grades-header"><h1>{t('grades.title')}</h1></div>
        <div style={{ padding:'40px', textAlign:'center', color:'#ef4444' }}>
          <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('gradeStats.failedLoad')}</p>
          <p style={{ color:'#64748b', marginTop:8 }}>{error}</p>
          <button onClick={fetchGrades} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 {t('gradeStats.retry')}</button>
        </div>
      </div>
    );
  }

  const groupedGrades = groupBySemester(grades);

  return (
    <div className="grades-page">
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
              <span className="info-value">{grades.length}</span>
            </div>
          </div>
          {gpaData.partialCount > 0 && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 10,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
              fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⏳</span>
              <span>
                <strong>{gpaData.partialCount} course{gpaData.partialCount > 1 ? 's' : ''}</strong> {gpaData.partialCount > 1 ? 'have' : 'has'} scores announced but the <strong>Final Exam has not been graded yet</strong>. Not counted in your CGPA until finalized.
              </span>
            </div>
          )}
        </div>
      </div>

      {Object.keys(groupedGrades).length === 0 ? (
        <div className="empty-message">{t('grades.noGradesYet')}</div>
      ) : (
        <div className="semesters-container">
          {Object.entries(groupedGrades).map(([semester, semesterGrades]) => (
            <div key={semester} className="semester-section">
              <div className="semester-header">
                <h2>{semester}</h2>
                <span className="semester-gpa">{t('grades.semesterGPA')}: {calculateSemesterGPA(semesterGrades)}</span>
              </div>
              <div className="grades-table-container">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>{t('common.code')}</th>
                      <th>{t('grades.course')}</th>
                      <th>{t('grades.credits')}</th>
                      <th>Exam Scores</th>
                      <th>{t('grades.grade')}</th>
                      <th>GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesterGrades.map((grade) => {
                      const finalized = isGradeFinalized(grade);
                      // Build score breakdown — prefer components, fall back to legacy
                      const hasComponents = grade.components && grade.components.length > 0;
                      const scoreItems = hasComponents
                        ? grade.components.map(c => ({
                            name:     c.name,
                            score:    c.score,
                            maxScore: c.maxScore,
                            type:     c.type,
                          }))
                        : [
                            grade.quizScore      != null && { name: 'Quiz',       score: grade.quizScore,      maxScore: 100, type: 'quiz' },
                            grade.assignmentScore != null && { name: 'Assignment', score: grade.assignmentScore, maxScore: 100, type: 'assignment' },
                            grade.finalScore     != null && { name: 'Final Exam', score: grade.finalScore,     maxScore: 100, type: 'final' },
                          ].filter(Boolean);

                      return (
                        <tr key={grade._id} className={`${grade.isRetake ? 'retake-row' : ''} ${!finalized ? 'partial-grade-row' : ''}`}>
                          <td className="course-code-cell">{grade.course.courseCode}</td>
                          <td className="course-name-cell">
                            {grade.course.courseName}
                            {grade.isRetake && (
                              <span className="retake-badge" title={`Re-enrolled. Previous: ${grade.previousGrade || 'F'}. Max 83.`}>
                                🔁 Retook {grade.previousGrade ? `(was ${grade.previousGrade})` : '(was F)'}
                              </span>
                            )}
                            {!finalized && (
                              <span className="partial-badge" title="Scores visible — Final Exam not graded yet. Not counted in CGPA.">
                                ⏳ Pending Final
                              </span>
                            )}
                          </td>
                          <td className="credits-cell">{grade.course.credits}</td>
                          <td className="scores-breakdown-cell">
                            {scoreItems.length === 0 ? (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>Manual grade</span>
                            ) : (
                              <div className="score-chips">
                                {scoreItems.map((item, idx) => {
                                  const pct = item.score != null ? Math.round((item.score / item.maxScore) * 100) : null;
                                  const isFinalType = item.type === 'final';
                                  return (
                                    <span
                                      key={idx}
                                      className={`score-chip ${isFinalType ? 'score-chip-final' : ''} ${item.score == null ? 'score-chip-empty' : ''}`}
                                      title={`${item.name}: ${item.score ?? '—'}/${item.maxScore} (${pct ?? '—'}%)`}
                                    >
                                      <span className="score-chip-name">{item.name}</span>
                                      <span className="score-chip-val">
                                        {item.score != null ? `${item.score}/${item.maxScore}` : '—'}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`grade-badge ${gradeClass(grade.grade)}`} style={!finalized ? { opacity: 0.6 } : {}}>
                              {grade.grade}
                            </span>
                            {grade.isRetake && grade.grade !== 'F' && (
                              <span className="retake-cap-note" title="Grade capped at maximum 83 marks">⚠ max 83</span>
                            )}
                          </td>
                          <td className="grade-point-cell" style={!finalized ? { color: '#94a3b8' } : {}}>
                            {finalized ? grade.gradePoint.toFixed(2) : '—'}
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
      )}
    </div>
  );
};

export default Grades;

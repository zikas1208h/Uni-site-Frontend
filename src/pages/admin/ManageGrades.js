import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, gradeAPI, courseAPI, authAPI, pageCache } from '../../services/api';
import './ManageGrades.css';

// ── Grade helpers ─────────────────────────────────────────────────────────────
const calcLetterGradeFromTotal = (total) => {
  if (total >= 96) return { grade: 'A+', gradePoint: 4.0 };
  if (total >= 92) return { grade: 'A',  gradePoint: 3.7 };
  if (total >= 88) return { grade: 'A-', gradePoint: 3.4 };
  if (total >= 84) return { grade: 'B+', gradePoint: 3.2 };
  if (total >= 80) return { grade: 'B',  gradePoint: 3.0 };
  if (total >= 76) return { grade: 'B-', gradePoint: 2.8 };
  if (total >= 72) return { grade: 'C+', gradePoint: 2.6 };
  if (total >= 68) return { grade: 'C',  gradePoint: 2.4 };
  if (total >= 64) return { grade: 'C-', gradePoint: 2.2 };
  if (total >= 60) return { grade: 'D+', gradePoint: 2.0 };
  if (total >= 55) return { grade: 'D',  gradePoint: 1.5 };
  if (total >= 50) return { grade: 'D-', gradePoint: 1.0 };
  return               { grade: 'F',  gradePoint: 0.0 };
};
const RETAKE_MAX_SCORE = 83;

const gradeColor = (g) => {
  if (!g) return '#94a3b8';
  if (['A+','A','A-'].includes(g)) return '#22c55e';
  if (['B+','B','B-'].includes(g)) return '#3b82f6';
  if (['C+','C','C-'].includes(g)) return '#f59e0b';
  if (['D+','D','D-'].includes(g)) return '#f97316';
  return '#ef4444';
};

const MANUAL_GRADES  = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];
const GRADE_POINTS   = { 'A+':4.0,'A':3.7,'A-':3.4,'B+':3.2,'B':3.0,'B-':2.8,'C+':2.6,'C':2.4,'C-':2.2,'D+':2.0,'D':1.5,'D-':1.0,'F':0.0 };
const TYPE_ICONS     = { quiz:'📋', assignment:'📝', midterm:'📄', final:'🎓', other:'📊' };

const ManageGrades = () => {
  const navigate  = useNavigate();

  // ── Selection state ────────────────────────────────────────────────────────
  const [students,         setStudents]         = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState(null);
  const [enrolledCourses,  setEnrolledCourses]  = useState([]);
  const [gradedCourseIds,  setGradedCourseIds]  = useState(new Set());
  const [fetchingCourses,  setFetchingCourses]  = useState(false);
  const [selectedCourse,   setSelectedCourse]   = useState('');
  const [activeTab,        setActiveTab]        = useState('semester'); // 'semester' | 'classwork'

  // ── Semester grade state ───────────────────────────────────────────────────
  const [midtermScore,     setMidtermScore]     = useState('');
  const [midtermMaxScore,  setMidtermMaxScore]  = useState(40);
  const [finalScore,       setFinalScore]       = useState('');
  const [finalMaxScore,    setFinalMaxScore]    = useState(60);
  const [finalAlreadySet,  setFinalAlreadySet]  = useState(false); // lock after first save
  const [useManualGrade,   setUseManualGrade]   = useState(false);
  const [manualGrade,      setManualGrade]      = useState('A');
  const [semester,         setSemester]         = useState('Spring');
  const [year,             setYear]             = useState(new Date().getFullYear());
  const [isRetake,         setIsRetake]         = useState(false);

  // ── Classwork state ────────────────────────────────────────────────────────
  const [classworkEntries,    setClassworkEntries]    = useState([]); // from grade doc
  const [loadingClasswork,    setLoadingClasswork]    = useState(false);
  const [classworkScores,     setClassworkScores]     = useState({}); // { assignmentId: inputVal }
  const [classworkEditing,    setClassworkEditing]    = useState({}); // { assignmentId: bool }
  const [savingClasswork,     setSavingClasswork]     = useState({}); // { assignmentId: bool }

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading,          setLoading]          = useState(false);
  const [endingCourse,     setEndingCourse]     = useState(false);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [lastGradedCourse, setLastGradedCourse] = useState(null);

  // ── Compute semester preview ───────────────────────────────────────────────
  const semesterPreview = useMemo(() => {
    if (useManualGrade) return { grade: manualGrade, gradePoint: GRADE_POINTS[manualGrade], total: null };
    const hasMid = midtermScore !== '' && midtermScore != null;
    const hasFin = finalScore   !== '' && finalScore   != null;
    if (!hasMid && !hasFin) return null;
    const midPct = hasMid ? (Number(midtermScore) / Math.max(Number(midtermMaxScore), 1)) * 40 : 0;
    const finPct = hasFin ? (Number(finalScore)   / Math.max(Number(finalMaxScore),   1)) * 60 : 0;
    const total  = Math.min(Math.round((midPct + finPct) * 100) / 100, 100);
    if (!hasFin) return { grade: null, gradePoint: null, total, midOnly: true };
    const raw = calcLetterGradeFromTotal(isRetake ? Math.min(total, RETAKE_MAX_SCORE) : total);
    return { ...raw, total };
  }, [midtermScore, midtermMaxScore, finalScore, finalMaxScore, useManualGrade, manualGrade, isRetake]);

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    pageCache('managegrades:students', async () => {
      const [stuRes, meRes] = await Promise.all([studentAPI.getAllStudents(), authAPI.getMe()]);
      const allStudents = stuRes.data || [];
      const freshUser   = meRes.data;
      let visible = allStudents;
      if (freshUser && !['superadmin','admin'].includes(freshUser.role)) {
        if (!freshUser.permissions?.canViewAllStudents) {
          const assignedIds = new Set((freshUser.assignedCourses || []).map(c => (c._id || c).toString()));
          if (assignedIds.size > 0) {
            visible = allStudents.filter(s =>
              (s.enrolledCourses || []).some(cId => assignedIds.has((cId._id || cId).toString()))
            );
          }
        }
      }
      return visible;
    }, (visible) => { setStudents(visible); setFilteredStudents(visible); })
    .catch(() => setError('Failed to load students. Please refresh.'));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredStudents(students); return; }
    const q = searchTerm.toLowerCase();
    setFilteredStudents(students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    ));
  }, [searchTerm, students]);

  // ── Student change ─────────────────────────────────────────────────────────
  const handleStudentChange = async (e) => {
    const studentId = e.target.value;
    setSelectedStudent(students.find(s => s._id === studentId) || null);
    setSelectedCourse(''); setEnrolledCourses([]); setGradedCourseIds(new Set());
    resetCourseState();
    if (!studentId) return;
    setFetchingCourses(true);
    try {
      const [stuRes, gradesRes] = await Promise.all([
        studentAPI.getStudentById(studentId),
        gradeAPI.getStudentGradesById(studentId).catch(() => ({ data: { grades: [] } })),
      ]);
      setEnrolledCourses(stuRes.data.enrolledCourses || []);
      setGradedCourseIds(new Set(
        (gradesRes.data?.grades || [])
          .filter(g => g.semesterGrade?.isFinalized)
          .map(g => (g.course?._id || g.course || '').toString())
      ));
      if (!stuRes.data.enrolledCourses?.length) setError('This student has no enrolled courses.');
    } catch { setError('Failed to load courses.'); }
    finally { setFetchingCourses(false); }
  };

  const resetCourseState = () => {
    setMidtermScore(''); setMidtermMaxScore(40); setFinalScore(''); setFinalMaxScore(60);
    setFinalAlreadySet(false); setUseManualGrade(false); setManualGrade('A');
    setIsRetake(false); setClassworkEntries([]); setClassworkScores({});
    setClassworkEditing({}); setSavingClasswork({}); setError(''); setSuccess(''); setLastGradedCourse(null);
  };

  // ── Course change ──────────────────────────────────────────────────────────
  const handleCourseChange = async (courseId) => {
    setSelectedCourse(courseId);
    resetCourseState();
    if (!courseId || !selectedStudent) return;
    setLoadingClasswork(true);
    try {
      const gradesRes = await gradeAPI.getStudentGradesById(selectedStudent._id).catch(() => ({ data: { grades: [] } }));
      const existingGrade = (gradesRes.data?.grades || []).find(
        g => (g.course?._id || g.course)?.toString() === courseId
      );
      if (existingGrade) {
        setIsRetake(existingGrade.isRetake === true);
        setSemester(existingGrade.semester || 'Spring');
        setYear(existingGrade.year || new Date().getFullYear());
        const sg = existingGrade.semesterGrade || {};
        if (sg.midtermScore != null) { setMidtermScore(String(sg.midtermScore)); setMidtermMaxScore(sg.midtermMaxScore || 40); }
        if (sg.finalScore   != null) { setFinalScore(String(sg.finalScore));     setFinalMaxScore(sg.finalMaxScore   || 60); setFinalAlreadySet(true); }
        // Load classwork from grade doc
        const cw = existingGrade.classwork || [];
        setClassworkEntries(cw);
        const scores = {};
        const editing = {};
        cw.forEach(e => { scores[e.assignmentId] = e.score != null ? String(e.score) : ''; editing[e.assignmentId] = false; });
        setClassworkScores(scores);
        setClassworkEditing(editing);
      }
    } catch { setError('Failed to load grade data.'); }
    finally { setLoadingClasswork(false); }
  };

  // ── Save semester grade ────────────────────────────────────────────────────
  const handleSaveSemesterGrade = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedStudent || !selectedCourse) { setError('Select student and course first'); return; }
    setLoading(true);
    try {
      let payload = { student: selectedStudent._id, course: selectedCourse, semester, year: parseInt(year) };
      if (useManualGrade) {
        payload.grade = manualGrade; payload.gradePoint = GRADE_POINTS[manualGrade];
      } else {
        if (midtermScore !== '') { payload.midtermScore = Number(midtermScore); payload.midtermMaxScore = Number(midtermMaxScore); }
        if (finalScore   !== '') { payload.finalScore   = Number(finalScore);   payload.finalMaxScore   = Number(finalMaxScore);   }
      }
      const res = await gradeAPI.saveSemesterGrade(payload);
      const sg = res.data?.semesterGrade || {};
      const isNowFinalized = sg.isFinalized;
      setSuccess(isNowFinalized
        ? `✅ Final grade saved! ${sg.grade} (${sg.gradePoint?.toFixed(1)}) — CGPA updated.`
        : `✅ Midterm score saved. CGPA will update when Final Exam is graded.`
      );
      if (isNowFinalized) {
        setFinalAlreadySet(true);
        setGradedCourseIds(prev => new Set([...prev, selectedCourse.toString()]));
        const gradedCourse = enrolledCourses.find(c => c._id === selectedCourse);
        setLastGradedCourse({ id: selectedCourse, name: gradedCourse?.courseName, status: gradedCourse?.status || 'active' });
      }
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  // ── Grade a classwork entry ────────────────────────────────────────────────
  const handleGradeClasswork = async (assignmentId) => {
    const scoreVal = classworkScores[assignmentId];
    if (scoreVal === '' || scoreVal == null) { setError('Enter a score first'); return; }
    setSavingClasswork(p => ({ ...p, [assignmentId]: true }));
    setError('');
    try {
      await gradeAPI.gradeClasswork(assignmentId, selectedStudent._id, Number(scoreVal));
      setClassworkEntries(prev => prev.map(e =>
        e.assignmentId === assignmentId ? { ...e, score: Number(scoreVal), isGraded: true } : e
      ));
      setClassworkEditing(p => ({ ...p, [assignmentId]: false }));
      setSuccess('✅ Classwork score saved.');
    } catch (err) { setError(err.response?.data?.message || 'Failed to save score'); }
    finally { setSavingClasswork(p => ({ ...p, [assignmentId]: false })); }
  };

  const handleMarkEnded = async () => {
    if (!lastGradedCourse) return;
    setEndingCourse(true);
    try {
      const newStatus = lastGradedCourse.status === 'completed' ? 'active' : 'completed';
      await courseAPI.setCourseStatus(lastGradedCourse.id, newStatus);
      setLastGradedCourse(prev => ({ ...prev, status: newStatus }));
      setSuccess(prev => prev + (newStatus === 'completed' ? ` Course "${lastGradedCourse.name}" marked COMPLETED.` : ` Course reactivated.`));
    } catch { setError('Failed to update course status.'); }
    finally { setEndingCourse(false); }
  };

  return (
    <div className="manage-grades">
      <div className="manage-grades-header">
        <h1>📊 Manage Student Grades</h1>
        <p>Two sections: <strong>Semester Grades</strong> (Midterm + Final, affects GPA) &amp; <strong>Classwork</strong> (Assignments &amp; Quizzes, raw marks only)</p>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {lastGradedCourse && (
        <div className="mark-ended-banner">
          <div className="mark-ended-info">
            <span className="mark-ended-icon">{lastGradedCourse.status === 'completed' ? '✅' : '🟢'}</span>
            <div>
              <p className="mark-ended-title"><strong>{lastGradedCourse.name}</strong> is <span className={`status-badge ${lastGradedCourse.status}`}>{lastGradedCourse.status.toUpperCase()}</span></p>
              <p className="mark-ended-hint">{lastGradedCourse.status === 'completed' ? 'Course completed.' : 'Mark as completed when all grades are submitted.'}</p>
            </div>
          </div>
          <button className={`btn-mark-ended ${lastGradedCourse.status === 'completed' ? 'btn-reactivate' : ''}`} onClick={handleMarkEnded} disabled={endingCourse}>
            {endingCourse ? '…' : lastGradedCourse.status === 'completed' ? '🔓 Reactivate' : '✅ Mark Completed'}
          </button>
        </div>
      )}

      {/* ── Student & Course Selection ── */}
      <div className="form-section">
        <h2>👨‍🎓 Student &amp; Course</h2>
        <div className="form-group">
          <label>🔍 Search</label>
          <input type="text" className="search-input" placeholder="Name, student ID, or email…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <small>{filteredStudents.length} student(s) found</small>}
        </div>
        <div className="form-group">
          <label>Select Student *</label>
          <div className="student-select-row">
            <select value={selectedStudent?._id || ''} onChange={handleStudentChange} required>
              <option value="">-- Choose a student --</option>
              {filteredStudents.map(s => (
                <option key={s._id} value={s._id}>{s.studentId} – {s.firstName} {s.lastName}</option>
              ))}
            </select>
            {selectedStudent && (
              <button type="button" className="btn-view-profile" onClick={() => navigate(`/admin/student/${selectedStudent._id}`)}>👁 Profile</button>
            )}
          </div>
        </div>
        <div className="form-group">
          <label>Course (Enrolled Only) *</label>
          {fetchingCourses ? <div className="loading-courses">⏳ Loading…</div> : (
            <select value={selectedCourse} onChange={e => handleCourseChange(e.target.value)}
              required disabled={!selectedStudent || enrolledCourses.length === 0}>
              <option value="">{!selectedStudent ? '-- Select student first --' : enrolledCourses.length === 0 ? '-- No enrolled courses --' : '-- Choose a course --'}</option>
              {[...enrolledCourses].sort((a, b) => {
                const aG = gradedCourseIds.has(a._id.toString()), bG = gradedCourseIds.has(b._id.toString());
                return aG === bG ? 0 : aG ? 1 : -1;
              }).map(c => {
                const isGraded = gradedCourseIds.has(c._id.toString());
                return <option key={c._id} value={c._id}>{isGraded ? '✓ [GRADED] ' : ''}{c.courseCode} – {c.courseName}{c.status === 'completed' ? ' [COMPLETED]' : ''}</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      {selectedCourse && (
        <>
          {isRetake && (
            <div style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>⚠️</span>
              <div>
                <strong style={{ color:'#d97706' }}>Retake Student</strong>
                <p style={{ fontSize:13, color:'#92400e', margin:'2px 0 0' }}>Previously failed — semester grade capped at <strong>83 marks (B)</strong>.</p>
              </div>
            </div>
          )}

              <button type="button" className={`mode-btn ${inputMode === 'manual' ? 'active' : ''}`} onClick={() => setInputMode('manual')}>
                ✏️ Manual Grade
              </button>
            </div>

            {/* Components */}
            {inputMode === 'components' && (
              <div className="components-table-wrap">
                {loadingComponents ? (
                  <div className="loading-courses">⏳ Loading components from announcements…</div>
                ) : components.length === 0 ? (
                  <div style={{ padding:'24px', textAlign:'center', color:'#94a3b8', borderRadius:10, border:'2px dashed rgba(148,163,184,0.3)' }}>
                    <p style={{ fontSize:15 }}>📭 No assignments or exams posted for this course yet.</p>
                    <p style={{ fontSize:13, marginTop:6 }}>Post them from the Assignments page — they auto-appear here as grade components.</p>
                    <button type="button" className="mode-btn active" style={{ marginTop:12 }} onClick={() => setInputMode('manual')}>Use Manual Grade instead</button>
                  </div>
                ) : (
                  <>
                    <p className="components-hint">
                      Components are auto-loaded from posted assignments &amp; exams.
                      <span style={{ color:'#22c55e' }}> ✅ Graded</span> items are locked — click ✏️ Edit to change.
                    </p>
                    <div className="components-table">
                      <div className="comp-thead">
                        <span>Component</span><span>Type</span><span>Score</span><span>Max</span><span>Weight %</span><span>%</span><span>Status</span>
                      </div>
                      {components.map((c, i) => {
                        const pct = (c.score !== '' && c.score != null && c.maxScore)
                          ? ((Number(c.score) / Number(c.maxScore)) * 100).toFixed(1) : '—';
                        const locked = c.isGraded && !c.isEditing;
                        return (
                          <div key={i} className={`comp-row ${c.isGraded ? 'comp-row-graded' : ''}`}>
                            <span className="comp-name-static">{TYPE_ICONS[c.type] || '📊'} {c.name}</span>
                            <span className="comp-type-badge" data-type={c.type}>{c.type}</span>
                            <input className={`comp-input comp-score ${locked ? 'comp-input-locked' : ''}`}
                              type="number" min="0" max={c.maxScore} step="0.5"
                              value={c.score} onChange={e => updateScore(i, e.target.value)}
                              placeholder="Score" disabled={locked} />
                            <span className="comp-max-static">/ {c.maxScore}</span>
                            <input className={`comp-input comp-weight ${locked ? 'comp-input-locked' : ''}`}
                              type="number" min="1" max="200"
                              value={c.weight} onChange={e => updateWeight(i, e.target.value)}
                              disabled={locked} />
                            <span className="comp-pct" style={{ color: pct !== '—' ? (Number(pct) >= 50 ? '#22c55e' : '#ef4444') : '#94a3b8' }}>
                              {pct !== '—' ? `${pct}%` : '—'}
                            </span>
                            <span className="comp-status">
                              {c.isGraded ? (
                                <button type="button" className="comp-edit-btn" onClick={() => toggleEdit(i)}>
                                  {c.isEditing ? '🔒 Lock' : '✏️ Edit'}
                                </button>
                              ) : <span style={{ color:'#94a3b8', fontSize:12 }}>Ungraded</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="comp-actions">
                      {compTotal != null && (
                        <span className="comp-total">
                          Weighted Total: <strong>{compTotal.toFixed(1)}</strong>/100
                          → <span style={{ color: gradeColor(compPreview?.grade), fontWeight:800 }}>{compPreview?.grade} ({compPreview?.gradePoint?.toFixed(1)})</span>
                        </span>
                      )}
                    </div>
                    {!hasFinalGraded && components.some(c => c.score !== '' && c.score != null) && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:10, padding:'10px 14px' }}>
                        <span>⚠️</span>
                        <div>
                          <strong style={{ color:'#d97706', fontSize:13 }}>GPA Pending Final Exam</strong>
                          <p style={{ fontSize:12, color:'#92400e', margin:'2px 0 0' }}>Scores visible to student but won't affect CGPA until Final Exam is graded.</p>
                        </div>
                      </div>
                    )}
                    {hasFinalGraded && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.35)', borderRadius:10, padding:'10px 14px' }}>
                        <span>✅</span>
                        <strong style={{ color:'#16a34a', fontSize:13 }}>Final Exam graded — will update CGPA.</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Manual */}
            {inputMode === 'manual' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Letter Grade *</label>
                  <select value={manualGrade} onChange={e => { setManualGrade(e.target.value); setManualGP(GRADE_POINTS[e.target.value]); }} required>
                    {MANUAL_GRADES.map(g => <option key={g} value={g}>{g} ({GRADE_POINTS[g].toFixed(1)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Grade Point</label>
                  <input type="number" value={manualGP} readOnly step="0.1" min="0" max="4" />
                </div>
              </div>
            )}

            <div className="form-row" style={{ marginTop:16 }}>
              <div className="form-group">
                <label>Semester *</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} required>
                  <option value="Fall">Fall</option><option value="Spring">Spring</option><option value="Summer">Summer</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year *</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} required min="2024" max="2030" />
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {selectedCourse && (
          <div className="grade-preview">
            <h3>📊 Grade Preview</h3>
            <div className="preview-content">
              <div className="preview-item"><span className="preview-label">Student:</span><span className="preview-value">{selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : '—'}</span></div>
              <div className="preview-item"><span className="preview-label">Course:</span><span className="preview-value">{selectedCourseName || '—'}</span></div>
              {inputMode === 'components' && compPreview && (
                <div className="preview-item"><span className="preview-label">Weighted Total:</span><span className="preview-value"><strong>{compTotal?.toFixed(1)}</strong> / 100</span></div>
              )}
              <div className="preview-item">
                <span className="preview-label">Grade:</span>
                <span className="preview-value" style={{ color: gradeColor(inputMode === 'components' ? compPreview?.grade : manualGrade), fontWeight:800, fontSize:20 }}>
                  {inputMode === 'components'
                    ? (compPreview ? `${compPreview.grade} (${compPreview.gradePoint.toFixed(1)})` : '—')
                    : `${manualGrade} (${GRADE_POINTS[manualGrade].toFixed(1)})`}
                  {isRetake && <span style={{ fontSize:11, color:'#d97706', fontWeight:600, marginLeft:8 }}>⚠ max B (83)</span>}
                </span>
              </div>
              <div className="preview-item">
                <span className="preview-label">GPA Impact:</span>
                <span className="preview-value" style={{ fontWeight:700, color:(inputMode === 'manual' || hasFinalGraded) ? '#16a34a' : '#d97706' }}>
                  {(inputMode === 'manual' || hasFinalGraded) ? '✅ Will update CGPA' : '⏳ Pending Final Exam'}
                </span>
              </div>
              <div className="preview-item"><span className="preview-label">Period:</span><span className="preview-value">{semester} {year}</span></div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || !selectedStudent || !selectedCourse} className="btn-primary">
            {loading ? 'Saving…' : 'Save Grade'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManageGrades;


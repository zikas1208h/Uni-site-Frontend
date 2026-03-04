import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, gradeAPI, courseAPI, authAPI, assignmentAPI, pageCache } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
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

const calcFromComponents = (comps) => {
  const filled = comps.filter(c => c.score !== '' && c.score != null && Number(c.maxScore) > 0 && c.weight !== '' && c.weight != null);
  if (!filled.length) return null;
  const totalWeight = filled.reduce((s, c) => s + Number(c.weight), 0);
  if (!totalWeight) return null;
  const weighted = filled.reduce((s, c) => s + (Number(c.score) / Number(c.maxScore)) * Number(c.weight), 0);
  return (weighted / totalWeight) * 100;
};

const gradeColor = (g) => {
  if (!g) return '#94a3b8';
  if (['A+','A','A-'].includes(g)) return '#22c55e';
  if (['B+','B','B-'].includes(g)) return '#3b82f6';
  if (['C+','C','C-'].includes(g)) return '#f59e0b';
  if (['D+','D','D-'].includes(g)) return '#f97316';
  return '#ef4444';
};

const TYPE_ICONS = { quiz:'📋', midterm:'📄', final:'🎓', assignment:'📝', other:'📊' };
const MANUAL_GRADES = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];
const GRADE_POINTS  = { 'A+':4.0,'A':3.7,'A-':3.4,'B+':3.2,'B':3.0,'B-':2.8,'C+':2.6,'C':2.4,'C-':2.2,'D+':2.0,'D':1.5,'D-':1.0,'F':0.0 };

const ManageGrades = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [students,         setStudents]         = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState(null);
  const [enrolledCourses,  setEnrolledCourses]  = useState([]);
  const [gradedCourseIds,  setGradedCourseIds]  = useState(new Set());
  const [fetchingCourses,  setFetchingCourses]  = useState(false);

  const [inputMode,         setInputMode]         = useState('components');
  const [isRetake,          setIsRetake]          = useState(false);
  const [components,        setComponents]        = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);

  const [manualGrade, setManualGrade] = useState('A');
  const [manualGP,    setManualGP]    = useState(4.0);
  const [semester,    setSemester]    = useState('Spring');
  const [year,        setYear]        = useState(new Date().getFullYear());

  const [selectedCourse,   setSelectedCourse]   = useState('');
  const [loading,          setLoading]          = useState(false);
  const [endingCourse,     setEndingCourse]     = useState(false);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [lastGradedCourse, setLastGradedCourse] = useState(null);

  const compTotal   = useMemo(() => calcFromComponents(components), [components]);
  const compPreview = compTotal != null ? { ...calcLetterGradeFromTotal(compTotal), total: compTotal } : null;
  const hasFinalGraded = useMemo(() =>
    components.some(c => c.type === 'final' && c.score !== '' && c.score != null),
    [components]
  );

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
    setSelectedCourse('');
    setEnrolledCourses([]); setGradedCourseIds(new Set());
    setComponents([]); setError(''); setSuccess(''); setLastGradedCourse(null);
    if (!studentId) return;
    setFetchingCourses(true);
    try {
      const [stuRes, gradesRes] = await Promise.all([
        studentAPI.getStudentById(studentId),
        gradeAPI.getStudentGradesById(studentId).catch(() => ({ data: { grades: [] } })),
      ]);
      setEnrolledCourses(stuRes.data.enrolledCourses || []);
      setGradedCourseIds(new Set(
        (gradesRes.data?.grades || []).map(g => (g.course?._id || g.course || '').toString())
      ));
      if (!stuRes.data.enrolledCourses?.length) setError('This student has no enrolled courses.');
    } catch { setError('Failed to load courses.'); }
    finally { setFetchingCourses(false); }
  };

  // ── Course change — auto-load assignments ─────────────────────────────────
  const handleCourseChange = async (courseId) => {
    setSelectedCourse(courseId);
    setComponents([]); setError(''); setSuccess('');
    setIsRetake(false);
    if (!courseId || !selectedStudent) return;

    setLoadingComponents(true);
    try {
      const [compRes, gradesRes] = await Promise.all([
        assignmentAPI.getCourseComponents(courseId).catch(() => ({ data: [] })),
        gradeAPI.getStudentGradesById(selectedStudent._id).catch(() => ({ data: { grades: [] } })),
      ]);

      const courseComponents = compRes.data || [];
      const existingGrade = (gradesRes.data?.grades || []).find(
        g => (g.course?._id || g.course) === courseId
      );

      if (existingGrade) {
        setIsRetake(existingGrade.isRetake === true);
        setSemester(existingGrade.semester || 'Spring');
        setYear(existingGrade.year || new Date().getFullYear());
      }

      if (courseComponents.length === 0) {
        setComponents([]);
        setInputMode('manual');
      } else {
        setInputMode('components');
        const existingComps = existingGrade?.components || [];
        const mapped = courseComponents.map(ac => {
          const saved = existingComps.find(ec =>
            (ec.assignmentId && ec.assignmentId === ac.assignmentId?.toString()) ||
            (ec.name === ac.name && ec.type === ac.type)
          );
          const studentScoreObj = ac.studentScores ? ac.studentScores[selectedStudent._id] : null;
          const resolvedScore = saved?.score != null ? saved.score
            : (studentScoreObj?.score != null ? studentScoreObj.score : '');
          const isAlreadyGraded = resolvedScore !== '' && resolvedScore != null;
          return {
            assignmentId: ac.assignmentId,
            name:     ac.name,
            type:     ac.type,
            maxScore: ac.maxScore,
            weight:   ac.weight,
            score:    resolvedScore !== '' ? String(resolvedScore) : '',
            isGraded:  isAlreadyGraded,
            isEditing: false,
          };
        });
        setComponents(mapped);
      }
    } catch { setError('Failed to load course components.'); }
    finally { setLoadingComponents(false); }
  };

  const updateScore  = (i, val) => setComponents(p => p.map((c, idx) => idx === i ? { ...c, score: val } : c));
  const updateWeight = (i, val) => setComponents(p => p.map((c, idx) => idx === i ? { ...c, weight: val } : c));
  const toggleEdit   = (i)      => setComponents(p => p.map((c, idx) => idx === i ? { ...c, isEditing: !c.isEditing } : c));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLastGradedCourse(null);
    if (!selectedStudent || !selectedCourse) { setError('Please select both student and course'); return; }

    if (inputMode === 'components') {
      const filled = components.filter(c => c.score !== '' && c.score != null);
      if (!filled.length) { setError('Enter at least one score'); return; }
      for (const c of filled) {
        if (Number(c.score) < 0 || Number(c.score) > Number(c.maxScore)) {
          setError(`Score for "${c.name}" must be between 0 and ${c.maxScore}`); return;
        }
        if (!c.weight || Number(c.weight) <= 0) {
          setError(`Weight for "${c.name}" must be greater than 0`); return;
        }
      }
    }

    setLoading(true);
    try {
      let payload = { student: selectedStudent._id, course: selectedCourse, semester, year: parseInt(year) };

      if (inputMode === 'components') {
        payload.components = components
          .filter(c => c.score !== '' && c.score != null)
          .map(c => ({ name: c.name, type: c.type, assignmentId: c.assignmentId, score: Number(c.score), maxScore: Number(c.maxScore), weight: Number(c.weight) }));
      } else {
        payload.grade = manualGrade; payload.gradePoint = GRADE_POINTS[manualGrade];
      }

      const res = await gradeAPI.addGrade(payload);
      const gradedCourse = enrolledCourses.find(c => c._id === selectedCourse);
      const savedGrade   = inputMode === 'components' ? compPreview?.grade : manualGrade;
      const retakeCapped = res.data?._retakeCapped;

      setSuccess(retakeCapped
        ? `✅ Retake grade saved! Grade capped at B (max 83).`
        : `✅ Grade ${savedGrade} saved for ${selectedStudent.firstName} ${selectedStudent.lastName}!`
      );
      setLastGradedCourse({ id: selectedCourse, name: gradedCourse?.courseName, status: gradedCourse?.status || 'active' });
      setGradedCourseIds(prev => new Set([...prev, selectedCourse.toString()]));
      setComponents(prev => prev.map(c =>
        c.score !== '' && c.score != null ? { ...c, isGraded: true, isEditing: false } : c
      ));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grade');
    } finally { setLoading(false); }
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

  const selectedCourseName = selectedCourse ? enrolledCourses.find(c => c._id === selectedCourse)?.courseName : null;

  return (
    <div className="manage-grades">
      <div className="manage-grades-header">
        <h1>📊 Manage Student Grades</h1>
        <p>Components auto-load from posted assignments &amp; exams — no manual entry needed</p>
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

      <form onSubmit={handleSubmit} className="grades-form">
        {/* Student Selection */}
        <div className="form-section">
          <h2>👨‍🎓 Student Selection</h2>
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

        {/* Grade Entry */}
        {selectedCourse && (
          <div className="form-section">
            <h2>📝 Grade Entry</h2>

            {isRetake && (
              <div style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>⚠️</span>
                <div>
                  <strong style={{ color:'#d97706' }}>Retake Student</strong>
                  <p style={{ fontSize:13, color:'#92400e', margin:'2px 0 0' }}>Previously failed — max grade capped at <strong>83 marks (B)</strong>.</p>
                </div>
              </div>
            )}

            <div className="grade-mode-toggle">
              <button type="button" className={`mode-btn ${inputMode === 'components' ? 'active' : ''}`} onClick={() => setInputMode('components')}>
                📊 Exam Components
              </button>
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


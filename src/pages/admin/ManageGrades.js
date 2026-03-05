import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, gradeAPI, courseAPI, authAPI, pageCache } from '../../services/api';
import './ManageGrades.css';

// ── Grade helpers ─────────────────────────────────────────────────────────────
const calcLetterGrade = (total) => {
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
const RETAKE_CAP   = 83;
const MANUAL_GRADES = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];
const GRADE_POINTS  = { 'A+':4.0,'A':3.7,'A-':3.4,'B+':3.2,'B':3.0,'B-':2.8,'C+':2.6,'C':2.4,'C-':2.2,'D+':2.0,'D':1.5,'D-':1.0,'F':0.0 };
const TYPE_ICONS    = { quiz:'📋', assignment:'📝', midterm:'📄', other:'📊' };
const gradeColor = (g) => {
  if (!g) return '#94a3b8';
  if (['A+','A','A-'].includes(g)) return '#22c55e';
  if (['B+','B','B-'].includes(g)) return '#3b82f6';
  if (['C+','C','C-'].includes(g)) return '#f59e0b';
  if (['D+','D','D-'].includes(g)) return '#f97316';
  return '#ef4444';
};
// Stable key for classwork entry
const entryKey = (e) => e.assignmentId?.toString() || `manual-${e.name}-${e.type}`;

const ManageGrades = () => {
  const navigate = useNavigate();

  // ── Selection ──────────────────────────────────────────────────────────────
  const [students,         setStudents]         = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState(null);
  const [enrolledCourses,  setEnrolledCourses]  = useState([]);
  const [gradedCourseIds,  setGradedCourseIds]  = useState(new Set());
  const [fetchingCourses,  setFetchingCourses]  = useState(false);
  const [selectedCourse,   setSelectedCourse]   = useState('');
  const [selectedCourseData, setSelectedCourseData] = useState(null); // full course obj
  const [activeTab,        setActiveTab]        = useState('semester');

  // ── Semester grade (Final + Practical) ────────────────────────────────────
  const [finalScore,        setFinalScore]        = useState('');
  const [finalMaxScore,     setFinalMaxScore]      = useState(100);
  const [practicalScore,    setPracticalScore]     = useState('');
  const [practicalMaxScore, setPracticalMaxScore]  = useState(100);
  const [finalAlreadySet,   setFinalAlreadySet]    = useState(false);
  const [useManualGrade,    setUseManualGrade]     = useState(false);
  const [manualGrade,       setManualGrade]        = useState('A');
  const [semester,          setSemester]           = useState('Spring');
  const [year,              setYear]               = useState(new Date().getFullYear());
  const [isRetake,          setIsRetake]           = useState(false);

  // ── Classwork ──────────────────────────────────────────────────────────────
  const [classworkEntries,  setClassworkEntries]  = useState([]);
  const [loadingClasswork,  setLoadingClasswork]  = useState(false);
  const [classworkScores,   setClassworkScores]   = useState({});
  const [classworkEditing,  setClassworkEditing]  = useState({});
  const [savingClasswork,   setSavingClasswork]   = useState({});
  // Manual add form
  const [showManualAdd,     setShowManualAdd]      = useState(false);
  const [manualName,        setManualName]         = useState('');
  const [manualType,        setManualType]         = useState('midterm');
  const [manualMax,         setManualMax]          = useState(100);
  const [addingManual,      setAddingManual]       = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [loading,           setLoading]           = useState(false);
  const [endingCourse,      setEndingCourse]      = useState(false);
  const [error,             setError]             = useState('');
  const [success,           setSuccess]           = useState('');
  const [lastGradedCourse,  setLastGradedCourse]  = useState(null);

  // ── Semester preview ───────────────────────────────────────────────────────
  const semesterPreview = useMemo(() => {
    if (useManualGrade) return { grade: manualGrade, gradePoint: GRADE_POINTS[manualGrade], total: null };
    const hasFin  = finalScore     !== '' && finalScore     != null;
    const hasPrac = practicalScore !== '' && practicalScore != null;
    const hasPracticalCourse = selectedCourseData?.hasPractical;

    if (!hasFin && !hasPrac) return null;

    let total;
    if (hasPracticalCourse && hasFin && hasPrac) {
      total = Math.min(
        parseFloat(((Number(finalScore) / Math.max(Number(finalMaxScore), 1)) * 60 + (Number(practicalScore) / Math.max(Number(practicalMaxScore), 1)) * 40).toFixed(2)),
        100
      );
    } else if (hasFin) {
      total = Math.min(parseFloat(((Number(finalScore) / Math.max(Number(finalMaxScore), 1)) * 100).toFixed(2)), 100);
    } else {
      total = Math.min(parseFloat(((Number(practicalScore) / Math.max(Number(practicalMaxScore), 1)) * 100).toFixed(2)), 100);
    }

    const isFinalized = hasFin;
    if (!isFinalized) return { grade: null, total, midOnly: true };
    const cappedTotal = isRetake ? Math.min(total, RETAKE_CAP) : total;
    return { ...calcLetterGrade(cappedTotal), total };
  }, [finalScore, finalMaxScore, practicalScore, practicalMaxScore, useManualGrade, manualGrade, isRetake, selectedCourseData]);

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    pageCache('managegrades:students', async () => {
      const [stuRes, meRes] = await Promise.all([studentAPI.getAllStudents(), authAPI.getMe()]);
      const all = stuRes.data || [];
      const me  = meRes.data;
      let visible = all;
      if (me && !['superadmin','admin'].includes(me.role) && !me.permissions?.canViewAllStudents) {
        const ids = new Set((me.assignedCourses || []).map(c => (c._id || c).toString()));
        if (ids.size > 0) visible = all.filter(s => (s.enrolledCourses || []).some(c => ids.has((c._id || c).toString())));
      }
      return visible;
    }, (v) => { setStudents(v); setFilteredStudents(v); })
    .catch(() => setError('Failed to load students.'));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredStudents(students); return; }
    const q = searchTerm.toLowerCase();
    setFilteredStudents(students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    ));
  }, [searchTerm, students]);

  const resetCourseState = () => {
    setFinalScore(''); setFinalMaxScore(100); setPracticalScore(''); setPracticalMaxScore(100);
    setFinalAlreadySet(false); setUseManualGrade(false); setManualGrade('A'); setIsRetake(false);
    setClassworkEntries([]); setClassworkScores({}); setClassworkEditing({}); setSavingClasswork({});
    setShowManualAdd(false); setManualName(''); setManualType('midterm'); setManualMax(100);
    setError(''); setSuccess(''); setLastGradedCourse(null); setSelectedCourseData(null);
  };

  const handleStudentChange = async (e) => {
    const sid = e.target.value;
    setSelectedStudent(students.find(s => s._id === sid) || null);
    setSelectedCourse(''); setEnrolledCourses([]); setGradedCourseIds(new Set());
    resetCourseState();
    if (!sid) return;
    setFetchingCourses(true);
    try {
      const [stuRes, gradesRes] = await Promise.all([
        studentAPI.getStudentById(sid),
        gradeAPI.getStudentGradesById(sid).catch(() => ({ data: { grades: [] } })),
      ]);
      setEnrolledCourses(stuRes.data.enrolledCourses || []);
      setGradedCourseIds(new Set(
        (gradesRes.data?.grades || []).filter(g => g.semesterGrade?.isFinalized)
          .map(g => (g.course?._id || g.course || '').toString())
      ));
      if (!stuRes.data.enrolledCourses?.length) setError('No enrolled courses.');
    } catch { setError('Failed to load courses.'); }
    finally { setFetchingCourses(false); }
  };

  const handleCourseChange = async (courseId) => {
    setSelectedCourse(courseId);
    resetCourseState();
    if (!courseId || !selectedStudent) return;
    const courseObj = enrolledCourses.find(c => c._id === courseId);
    setSelectedCourseData(courseObj || null);
    setLoadingClasswork(true);
    try {
      const gradesRes = await gradeAPI.getStudentGradesById(selectedStudent._id).catch(() => ({ data: { grades: [] } }));
      const existing  = (gradesRes.data?.grades || []).find(g => (g.course?._id || g.course)?.toString() === courseId);
      if (existing) {
        setIsRetake(existing.isRetake === true);
        setSemester(existing.semester || 'Spring');
        setYear(existing.year || new Date().getFullYear());
        const sg = existing.semesterGrade || {};
        if (sg.finalScore     != null) { setFinalScore(String(sg.finalScore));         setFinalMaxScore(sg.finalMaxScore || 100);     setFinalAlreadySet(true); }
        if (sg.practicalScore != null) { setPracticalScore(String(sg.practicalScore)); setPracticalMaxScore(sg.practicalMaxScore || 100); }
        const cw = existing.classwork || [];
        setClassworkEntries(cw);
        const scores = {}, editing = {};
        cw.forEach(e => { const k = entryKey(e); scores[k] = e.score != null ? String(e.score) : ''; editing[k] = false; });
        setClassworkScores(scores); setClassworkEditing(editing);
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
        if (finalScore     !== '') { payload.finalScore     = Number(finalScore);     payload.finalMaxScore     = Number(finalMaxScore);     }
        if (practicalScore !== '') { payload.practicalScore = Number(practicalScore); payload.practicalMaxScore = Number(practicalMaxScore); }
      }
      const res = await gradeAPI.saveSemesterGrade(payload);
      const sg  = res.data?.semesterGrade || {};
      setSuccess(sg.isFinalized
        ? `✅ Grade saved! ${sg.grade} (${sg.gradePoint?.toFixed(1)}) — CGPA updated.`
        : `✅ Score saved. CGPA updates when Final Exam is graded.`
      );
      if (sg.isFinalized) {
        setFinalAlreadySet(true);
        setGradedCourseIds(prev => new Set([...prev, selectedCourse.toString()]));
        const c = enrolledCourses.find(c => c._id === selectedCourse);
        setLastGradedCourse({ id: selectedCourse, name: c?.courseName, status: c?.status || 'active' });
      }
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  // ── Grade classwork entry ──────────────────────────────────────────────────
  const handleGradeClasswork = async (key) => {
    const scoreVal = classworkScores[key];
    if (scoreVal === '' || scoreVal == null) { setError('Enter a score first'); return; }
    setSavingClasswork(p => ({ ...p, [key]: true }));
    setError('');
    try {
      await gradeAPI.gradeClasswork(key, selectedStudent._id, Number(scoreVal));
      setClassworkEntries(prev => prev.map(e => entryKey(e) === key ? { ...e, score: Number(scoreVal), isGraded: true } : e));
      setClassworkEditing(p => ({ ...p, [key]: false }));
      setSuccess('✅ Classwork score saved.');
    } catch (err) { setError(err.response?.data?.message || 'Failed to save score'); }
    finally { setSavingClasswork(p => ({ ...p, [key]: false })); }
  };

  // ── Add manual classwork entry ─────────────────────────────────────────────
  const handleAddManual = async () => {
    if (!manualName.trim()) { setError('Enter a name for this entry'); return; }
    setAddingManual(true); setError('');
    try {
      const res = await gradeAPI.addManualClasswork({
        studentId: selectedStudent._id, courseId: selectedCourse,
        name: manualName.trim(), type: manualType, maxScore: Number(manualMax),
        semester, year: parseInt(year),
      });
      const newEntry = res.data?.entry;
      setClassworkEntries(prev => [...prev, newEntry]);
      const k = entryKey(newEntry);
      setClassworkScores(p => ({ ...p, [k]: '' }));
      setClassworkEditing(p => ({ ...p, [k]: false }));
      setManualName(''); setManualType('midterm'); setManualMax(100);
      setShowManualAdd(false);
      setSuccess(`✅ "${newEntry.name}" added to classwork.`);
    } catch (err) { setError(err.response?.data?.message || 'Failed to add entry'); }
    finally { setAddingManual(false); }
  };

  const handleMarkEnded = async () => {
    if (!lastGradedCourse) return;
    setEndingCourse(true);
    try {
      const newStatus = lastGradedCourse.status === 'completed' ? 'active' : 'completed';
      await courseAPI.setCourseStatus(lastGradedCourse.id, newStatus);
      setLastGradedCourse(prev => ({ ...prev, status: newStatus }));
      setSuccess(prev => prev + ` Course "${lastGradedCourse.name}" marked ${newStatus.toUpperCase()}.`);
    } catch { setError('Failed to update course status.'); }
    finally { setEndingCourse(false); }
  };

  return (
    <div className="manage-grades">
      <div className="manage-grades-header">
        <h1>📊 Manage Student Grades</h1>
        <p>
          <strong>Semester Grades</strong>: Final Exam + Practical (affects GPA) ·
          <strong> Classwork</strong>: Assignments, Quizzes &amp; Midterms (raw marks, no GPA impact)
        </p>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {lastGradedCourse && (
        <div className="mark-ended-banner">
          <div className="mark-ended-info">
            <span className="mark-ended-icon">{lastGradedCourse.status === 'completed' ? '✅' : '🟢'}</span>
            <div>
              <p className="mark-ended-title"><strong>{lastGradedCourse.name}</strong> — <span className={`status-badge ${lastGradedCourse.status}`}>{lastGradedCourse.status.toUpperCase()}</span></p>
              <p className="mark-ended-hint">{lastGradedCourse.status === 'completed' ? 'Course completed.' : 'Mark as completed when all grades are in.'}</p>
            </div>
          </div>
          <button className={`btn-mark-ended ${lastGradedCourse.status === 'completed' ? 'btn-reactivate' : ''}`} onClick={handleMarkEnded} disabled={endingCourse}>
            {endingCourse ? '…' : lastGradedCourse.status === 'completed' ? '🔓 Reactivate' : '✅ Mark Completed'}
          </button>
        </div>
      )}

      {/* ── Selection ── */}
      <div className="form-section">
        <h2>👨‍🎓 Student &amp; Course</h2>
        <div className="form-group">
          <label>🔍 Search</label>
          <input type="text" className="search-input" placeholder="Name, student ID, or email…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <small>{filteredStudents.length} student(s) found</small>}
        </div>
        <div className="form-group">
          <label>Student *</label>
          <div className="student-select-row">
            <select value={selectedStudent?._id || ''} onChange={handleStudentChange}>
              <option value="">-- Choose a student --</option>
              {filteredStudents.map(s => <option key={s._id} value={s._id}>{s.studentId} – {s.firstName} {s.lastName}</option>)}
            </select>
            {selectedStudent && (
              <button type="button" className="btn-view-profile" onClick={() => navigate(`/admin/student/${selectedStudent._id}`)}>👁 Profile</button>
            )}
          </div>
        </div>
        <div className="form-group">
          <label>Course *</label>
          {fetchingCourses ? <div className="loading-courses">⏳ Loading…</div> : (
            <select value={selectedCourse} onChange={e => handleCourseChange(e.target.value)}
              disabled={!selectedStudent || !enrolledCourses.length}>
              <option value="">{!selectedStudent ? '-- Select student first --' : !enrolledCourses.length ? '-- No enrolled courses --' : '-- Choose a course --'}</option>
              {[...enrolledCourses].sort((a, b) => {
                const aG = gradedCourseIds.has(a._id.toString()), bG = gradedCourseIds.has(b._id.toString());
                return aG === bG ? 0 : aG ? 1 : -1;
              }).map(c => (
                <option key={c._id} value={c._id}>
                  {gradedCourseIds.has(c._id.toString()) ? '✓ [GRADED] ' : ''}{c.courseCode} – {c.courseName}
                  {c.hasPractical ? ' 🔬' : ''}{c.status === 'completed' ? ' [COMPLETED]' : ''}
                </option>
              ))}
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
                <p style={{ fontSize:13, color:'#92400e', margin:'2px 0 0' }}>Semester grade capped at <strong>83 marks (B)</strong>.</p>
              </div>
            </div>
          )}

          <div className="grade-mode-toggle" style={{ marginBottom: 0 }}>
            <button type="button" className={`mode-btn ${activeTab === 'semester' ? 'active' : ''}`} onClick={() => setActiveTab('semester')}>
              🎓 Semester Grade <small style={{ opacity:.7 }}>(Final {selectedCourseData?.hasPractical ? '+ Practical' : ''} · affects GPA)</small>
            </button>
            <button type="button" className={`mode-btn ${activeTab === 'classwork' ? 'active' : ''}`} onClick={() => setActiveTab('classwork')}>
              📝 Classwork <small style={{ opacity:.7 }}>(Assignments, Quizzes &amp; Midterms · raw marks)</small>
            </button>
          </div>

          {/* ── SEMESTER TAB ── */}
          {activeTab === 'semester' && (
            <form onSubmit={handleSaveSemesterGrade} className="form-section" style={{ marginTop: 0 }}>
              <h2>🎓 Semester Grade</h2>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
                {selectedCourseData?.hasPractical
                  ? 'Final Exam (60%) + Practical Exam (40%) = total out of 100.'
                  : 'Final Exam score out of its max mark (total capped at 100).'}
                <strong style={{ color:'#d97706' }}> GPA only updates when Final Exam is graded.</strong>
              </p>

              <div className="grade-mode-toggle" style={{ marginBottom:16 }}>
                <button type="button" className={`mode-btn ${!useManualGrade ? 'active' : ''}`} onClick={() => setUseManualGrade(false)}>📊 Score Entry</button>
                <button type="button" className={`mode-btn ${useManualGrade ? 'active' : ''}`}  onClick={() => setUseManualGrade(true)}>✏️ Manual Grade</button>
              </div>

              {!useManualGrade ? (
                <>
                  {/* Final Exam */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>🎓 Final Exam Score {finalAlreadySet && <span style={{ marginLeft:6, color:'#22c55e', fontSize:11 }}>✅ Editing</span>}</label>
                      <input type="number" min="0" max={finalMaxScore} step="0.5"
                        value={finalScore} onChange={e => setFinalScore(e.target.value)} placeholder="e.g. 75" />
                    </div>
                    <div className="form-group">
                      <label>Final Max</label>
                      <input type="number" min="1" max="200" value={finalMaxScore} onChange={e => setFinalMaxScore(Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Practical — only for hasPractical courses */}
                  {selectedCourseData?.hasPractical && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>🔬 Practical Exam Score</label>
                        <input type="number" min="0" max={practicalMaxScore} step="0.5"
                          value={practicalScore} onChange={e => setPracticalScore(e.target.value)} placeholder="e.g. 80" />
                      </div>
                      <div className="form-group">
                        <label>Practical Max</label>
                        <input type="number" min="1" max="200" value={practicalMaxScore} onChange={e => setPracticalMaxScore(Number(e.target.value))} />
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {semesterPreview && (
                    <div style={{ marginTop:12, padding:'12px 16px', borderRadius:10, background: semesterPreview.midOnly ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.08)', border:`1px solid ${semesterPreview.midOnly ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        <span style={{ fontSize:28, fontWeight:800, color: gradeColor(semesterPreview.grade) }}>{semesterPreview.grade || '—'}</span>
                        <div>
                          <div style={{ fontSize:13, color:'#64748b' }}>Total: <strong>{semesterPreview.total?.toFixed(1)}</strong> / 100</div>
                          {semesterPreview.midOnly
                            ? <div style={{ fontSize:12, color:'#d97706' }}>⏳ Pending Final Exam — not yet in CGPA</div>
                            : <div style={{ fontSize:12, color:'#16a34a' }}>✅ Final graded — will update CGPA</div>}
                          {isRetake && semesterPreview.total > RETAKE_CAP && (
                            <div style={{ fontSize:12, color:'#d97706' }}>⚠ Retake cap at 83 → {calcLetterGrade(83).grade}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label>Letter Grade *</label>
                    <select value={manualGrade} onChange={e => setManualGrade(e.target.value)}>
                      {MANUAL_GRADES.map(g => <option key={g} value={g}>{g} ({GRADE_POINTS[g].toFixed(1)})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Grade Point</label>
                    <input type="number" value={GRADE_POINTS[manualGrade]} readOnly step="0.1" />
                  </div>
                </div>
              )}

              <div className="form-row" style={{ marginTop:16 }}>
                <div className="form-group">
                  <label>Semester *</label>
                  <select value={semester} onChange={e => setSemester(e.target.value)}>
                    <option value="Fall">Fall</option><option value="Spring">Spring</option><option value="Summer">Summer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Year *</label>
                  <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2024" max="2030" />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={loading || !selectedStudent || !selectedCourse} className="btn-primary">
                  {loading ? 'Saving…' : finalAlreadySet ? '💾 Update Grade' : '💾 Save Grade'}
                </button>
              </div>
            </form>
          )}

          {/* ── CLASSWORK TAB ── */}
          {activeTab === 'classwork' && (
            <div className="form-section" style={{ marginTop: 0 }}>
              <h2>📝 Classwork</h2>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
                Assignments and quizzes auto-appear when posted. Midterms can be added manually if not posted online.
                <strong> Raw marks only — no A–F, no GPA impact.</strong>
              </p>

              {loadingClasswork ? (
                <div className="loading-courses">⏳ Loading…</div>
              ) : (
                <>
                  {classworkEntries.length === 0 ? (
                    <div style={{ padding:'24px', textAlign:'center', color:'#94a3b8', borderRadius:10, border:'2px dashed rgba(148,163,184,0.3)', marginBottom:16 }}>
                      <p style={{ fontSize:15 }}>📭 No classwork entries yet.</p>
                      <p style={{ fontSize:13, marginTop:4 }}>Assignments/quizzes appear automatically when posted. Add midterms manually below.</p>
                    </div>
                  ) : (
                    <div className="components-table">
                      <div className="comp-thead">
                        <span>Name</span><span>Type</span><span>Score</span><span>Max</span><span>%</span><span>Action</span>
                      </div>
                      {classworkEntries.map((entry) => {
                        const key      = entryKey(entry);
                        const locked   = entry.isGraded && !classworkEditing[key];
                        const scoreIn  = classworkScores[key] ?? (entry.score != null ? String(entry.score) : '');
                        const pct      = entry.isGraded && entry.score != null ? ((entry.score / entry.maxScore) * 100).toFixed(1) : '—';
                        return (
                          <div key={key} className={`comp-row ${entry.isGraded ? 'comp-row-graded' : ''}`}>
                            <span className="comp-name-static">{TYPE_ICONS[entry.type] || '📊'} {entry.name}</span>
                            <span className="comp-type-badge" data-type={entry.type}>{entry.type}</span>
                            <input className={`comp-input comp-score ${locked ? 'comp-input-locked' : ''}`}
                              type="number" min="0" max={entry.maxScore} step="0.5"
                              value={scoreIn} onChange={e => setClassworkScores(p => ({ ...p, [key]: e.target.value }))}
                              placeholder="Score" disabled={locked} />
                            <span className="comp-max-static">/ {entry.maxScore}</span>
                            <span className="comp-pct" style={{ color: pct !== '—' ? (Number(pct) >= 50 ? '#22c55e' : '#ef4444') : '#94a3b8' }}>
                              {pct !== '—' ? `${pct}%` : '—'}
                            </span>
                            <span className="comp-status">
                              {entry.isGraded ? (
                                <div style={{ display:'flex', gap:6 }}>
                                  <button type="button" className="comp-edit-btn"
                                    onClick={() => setClassworkEditing(p => ({ ...p, [key]: !p[key] }))}>
                                    {classworkEditing[key] ? '🔒 Lock' : '✏️ Edit'}
                                  </button>
                                  {classworkEditing[key] && (
                                    <button type="button" className="comp-edit-btn" style={{ background:'rgba(34,197,94,0.15)', color:'#16a34a' }}
                                      onClick={() => handleGradeClasswork(key)} disabled={savingClasswork[key]}>
                                      {savingClasswork[key] ? '…' : '💾 Save'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button type="button" className="comp-edit-btn" style={{ background:'rgba(59,130,246,0.12)', color:'#2563eb' }}
                                  onClick={() => handleGradeClasswork(key)} disabled={savingClasswork[key] || scoreIn === ''}>
                                  {savingClasswork[key] ? '⏳' : '✅ Grade'}
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual add */}
                  {!showManualAdd ? (
                    <button type="button" className="btn-secondary" style={{ marginTop:12 }} onClick={() => setShowManualAdd(true)}>
                      ➕ Add Offline Entry (Midterm / Quiz)
                    </button>
                  ) : (
                    <div style={{ marginTop:16, padding:'16px', background:'rgba(59,130,246,0.06)', borderRadius:10, border:'1px solid rgba(59,130,246,0.2)' }}>
                      <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12, color:'#1e40af' }}>➕ Add Offline Classwork Entry</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Name *</label>
                          <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Midterm 1, Quiz 3…" />
                        </div>
                        <div className="form-group">
                          <label>Type</label>
                          <select value={manualType} onChange={e => setManualType(e.target.value)}>
                            <option value="midterm">Midterm</option>
                            <option value="quiz">Quiz</option>
                            <option value="assignment">Assignment</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Max Score</label>
                          <input type="number" min="1" max="200" value={manualMax} onChange={e => setManualMax(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        <button type="button" className="btn-primary" onClick={handleAddManual} disabled={addingManual || !manualName.trim()}>
                          {addingManual ? '⏳ Adding…' : '✅ Add Entry'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => { setShowManualAdd(false); setManualName(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManageGrades;


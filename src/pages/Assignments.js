import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { assignmentAPI, submissionAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import './Assignments.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SUBMISSION_ICONS = {
  link: '🔗', email: '📧', upload: '📤', inclass: '🏫', other: '📋', none: '🚫',
};
const SUBMISSION_LABELS = {
  link: 'Online Link', email: 'Email Submission', upload: 'File Upload',
  inclass: 'In-Class', other: 'Other', none: 'No Submission Required',
};
const EXAM_TYPE_ICONS = { quiz: '📋', midterm: '📄', final: '🎓', none: '📅' };
const EXAM_TYPE_LABELS = { quiz: 'Quiz', midterm: 'Midterm Exam', final: 'Final Exam', none: 'Exam' };

const getDeadlineStatus = (deadline) => {
  const now = new Date();
  const d = new Date(deadline);
  const diffMs = d - now;
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) return { label: 'Overdue', color: '#ef4444', bg: '#ef444415', urgent: true };
  if (diffH <= 24) return { label: `${Math.ceil(diffH)}h left`, color: '#f97316', bg: '#f9731615', urgent: true };
  if (diffH <= 72) return { label: `${Math.ceil(diffH / 24)}d left`, color: '#f59e0b', bg: '#f59e0b15', urgent: false };
  return { label: `${Math.ceil(diffH / 24)}d left`, color: '#22c55e', bg: '#22c55e15', urgent: false };
};

const Assignments = () => {
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded]       = useState(null);
  const [activeTab, setActiveTab]     = useState('assignments'); // 'assignments' | 'quizzes'

  // Per-assignment submission state: { [assignmentId]: { file, uploading, done, error, existing } }
  const [subState, setSubState] = useState({});

  const loadAssignments = useCallback(() => {
    setLoading(true);
    setError(null);
    assignmentAPI.getMyAssignments()
      .then(r => setAssignments(r.data || []))
      .catch(e => setError(e.response?.data?.message || 'Failed to load assignments'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // When an upload-type card is expanded, fetch existing submission status
  const handleExpand = useCallback(async (a) => {
    const id = a._id;
    setExpanded(prev => {
      const next = prev === id ? null : id;
      return next;
    });
    if (a.submissionType !== 'upload') return;
    if (subState[id]?.existing !== undefined) return; // already fetched
    setSubState(prev => ({ ...prev, [id]: { ...prev[id], loading: true } }));
    try {
      const r = await submissionAPI.getMySubmission(id);
      setSubState(prev => ({ ...prev, [id]: { ...prev[id], existing: r.data, loading: false } }));
    } catch {
      // 404 = not submitted yet — that's fine
      setSubState(prev => ({ ...prev, [id]: { ...prev[id], existing: null, loading: false } }));
    }
  }, [subState]);

  const handleFileSelect = (assignmentId, file) => {
    setSubState(prev => ({ ...prev, [assignmentId]: { ...prev[assignmentId], file, uploadError: null, done: false } }));
  };

  const handleUpload = async (assignmentId) => {
    const s = subState[assignmentId];
    if (!s?.file) return;
    setSubState(prev => ({ ...prev, [assignmentId]: { ...prev[assignmentId], uploading: true, uploadError: null } }));
    try {
      const r = await submissionAPI.submit(assignmentId, s.file);
      setSubState(prev => ({ ...prev, [assignmentId]: { ...prev[assignmentId], uploading: false, done: true, existing: r.data, file: null } }));
    } catch (e) {
      setSubState(prev => ({ ...prev, [assignmentId]: { ...prev[assignmentId], uploading: false, uploadError: e.response?.data?.message || 'Upload failed' } }));
    }
  };

  const courses = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      const id = a.course?._id || a.course;
      if (id && !map[id]) map[id] = a.course;
    });
    return Object.values(map);
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assignments.filter(a => {
      // Tab filter first
      const isQuiz = a.examType === 'quiz';
      if (activeTab === 'quizzes' && !isQuiz) return false;
      if (activeTab === 'assignments' && isQuiz) return false;

      const matchSearch = !q ||
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.course?.courseCode?.toLowerCase().includes(q) ||
        a.course?.courseName?.toLowerCase().includes(q);
      const matchCourse = courseFilter === 'all' || (a.course?._id || a.course) === courseFilter;
      const isOverdue = new Date(a.deadline) < new Date();
      const matchStatus = statusFilter === 'all' || (statusFilter === 'overdue' ? isOverdue : !isOverdue);
      return matchSearch && matchCourse && matchStatus;
    });
  }, [assignments, search, courseFilter, statusFilter, activeTab]);

  if (loading) return (
    <div className="assignments-page">
      <div className="asgn-loader"><div className="asgn-spinner" /><p>{t('common.loading')}</p></div>
    </div>
  );

  if (error) return (
    <div className="assignments-page">
      <div className="asgn-error"><span>⚠️</span><p>{error}</p><button onClick={loadAssignments}>🔄 {t('gradeStats.retry')}</button></div>
    </div>
  );

  return (
    <div className="assignments-page">
      <div className="asgn-header">
        <div>
          <h1>📝 {activeTab === 'quizzes' ? '📋 My Quizzes' : t('assignments.myAssignments')}</h1>
          <p>{t('assignments.title')}</p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div className="asgn-stats">
            <div className="asgn-stat"><span className="asgn-stat-val">{assignments.filter(a => activeTab === 'quizzes' ? a.examType === 'quiz' : a.examType !== 'quiz').length}</span><span className="asgn-stat-lbl">{t('dashboard.total')}</span></div>
            <div className="asgn-stat upcoming"><span className="asgn-stat-val">{assignments.filter(a => (activeTab === 'quizzes' ? a.examType === 'quiz' : a.examType !== 'quiz') && new Date(a.deadline) >= new Date()).length}</span><span className="asgn-stat-lbl">Upcoming</span></div>
            <div className="asgn-stat overdue"><span className="asgn-stat-val">{assignments.filter(a => (activeTab === 'quizzes' ? a.examType === 'quiz' : a.examType !== 'quiz') && new Date(a.deadline) < new Date()).length}</span><span className="asgn-stat-lbl">{t('assignments.overdue')}</span></div>
          </div>
          <button onClick={loadAssignments} style={{ padding:'8px 16px', background:'var(--card-bg)', border:'1px solid var(--border-color)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="grade-mode-toggle" style={{ marginBottom: 16 }}>
        <button className={`mode-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => { setActiveTab('assignments'); setSearch(''); setCourseFilter('all'); setStatusFilter('all'); }}>
          📝 Assignments
          <span style={{ marginLeft:6, fontSize:11, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'1px 7px' }}>
            {assignments.filter(a => a.examType !== 'quiz').length}
          </span>
        </button>
        <button className={`mode-btn ${activeTab === 'quizzes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('quizzes'); setSearch(''); setCourseFilter('all'); setStatusFilter('all'); }}>
          📋 Quizzes
          <span style={{ marginLeft:6, fontSize:11, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'1px 7px' }}>
            {assignments.filter(a => a.examType === 'quiz').length}
          </span>
        </button>
      </div>

      <div className="asgn-filters">
        <input className="asgn-search" placeholder={`🔍 ${t('viewStudents.searchPlaceholder')}`} value={search} onChange={e => setSearch(e.target.value)} />
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="asgn-select">
          <option value="all">{t('assignments.allCourses')}</option>
          {courses.map(c => (
            <option key={c?._id || c} value={c?._id || c}>{c?.courseCode} — {c?.courseName}</option>
          ))}
        </select>
        <div className="asgn-status-tabs">
          {[['all','All'],['upcoming','Upcoming'],['overdue',t('assignments.overdue')]].map(([val, lbl]) => (
            <button key={val} className={`asgn-status-tab ${statusFilter === val ? 'active' : ''}`} onClick={() => setStatusFilter(val)}>{lbl}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="asgn-empty">
          <span>{activeTab === 'quizzes' ? '📋' : '📭'}</span>
          <h3>{activeTab === 'quizzes' ? 'No quizzes yet' : t('assignments.noAssignments')}</h3>
          <p>{activeTab === 'quizzes'
            ? (assignments.filter(a => a.examType === 'quiz').length === 0
                ? 'No quizzes have been announced for your courses yet.'
                : 'Try adjusting your filters.')
            : (assignments.length === 0
                ? 'No assignments have been posted for your courses yet.'
                : 'Try adjusting your filters.')}
          </p>
        </div>
      ) : (
        <div className="asgn-list">
          {filtered.map(a => {
            const ds      = getDeadlineStatus(a.deadline);
            const isOpen  = expanded === a._id;
            const isOverdue = new Date(a.deadline) < new Date();
            const sub     = subState[a._id];

            return (
              <div key={a._id} className={`asgn-card ${ds.urgent ? 'urgent' : ''} ${isOpen ? 'open' : ''} ${a.isAnnouncement ? 'exam-card' : ''}`} style={{ '--ds-color': ds.color, '--ds-bg': ds.bg }}>
                <div className="asgn-card-header" onClick={() => handleExpand(a)}>
                  <div className="asgn-card-left">
                    <div className={`asgn-course-badge ${a.isAnnouncement ? 'exam-badge' : ''}`}>
                      {a.isAnnouncement ? (EXAM_TYPE_ICONS[a.examType] || '📅') : ''} {a.course?.courseCode || 'N/A'}
                    </div>
                    <div className="asgn-card-info">
                      <h3 className="asgn-title">
                        {a.isAnnouncement && <span className="asgn-exam-tag">{EXAM_TYPE_LABELS[a.examType] || t('assignments.exam')}</span>}
                        {a.title}
                      </h3>
                      <p className="asgn-course-name">{a.course?.courseName}</p>
                    </div>
                  </div>
                  <div className="asgn-card-right">
                    {sub?.existing && <span className="asgn-submitted-badge">✅ {t('assignments.submitted')}</span>}
                    <div className="asgn-deadline-badge" style={{ color: ds.color, background: ds.bg }}>
                      {a.isAnnouncement ? '📅' : '⏰'} {a.isAnnouncement ? new Date(a.deadline).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : ds.label}
                    </div>
                    <div className="asgn-deadline-date">
                      {new Date(a.deadline).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                    <span className={`asgn-chevron ${isOpen ? 'up' : ''}`}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="asgn-card-body">
                    <div className="asgn-description">
                      <h4>📋 {a.isAnnouncement ? t('assignments.quizNotice') : t('assignments.description')}</h4>
                      <p>{a.description}</p>
                    </div>

                    {a.isAnnouncement && (
                      <div className="asgn-exam-details">
                        <div className="asgn-exam-grid">
                          <div className="asgn-exam-item">
                            <span className="asgn-exam-lbl">{t('assignments.type')}</span>
                            <span className="asgn-exam-val">{EXAM_TYPE_ICONS[a.examType]} {EXAM_TYPE_LABELS[a.examType]}</span>
                          </div>
                          <div className="asgn-exam-item">
                            <span className="asgn-exam-lbl">{t('assignments.examDate')}</span>
                            <span className="asgn-exam-val">📅 {new Date(a.deadline).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                          {a.examDuration && <div className="asgn-exam-item"><span className="asgn-exam-lbl">Duration</span><span className="asgn-exam-val">⏱️ {a.examDuration} min</span></div>}
                          {a.examLocation && <div className="asgn-exam-item"><span className="asgn-exam-lbl">Location</span><span className="asgn-exam-val">📍 {a.examLocation}</span></div>}
                          <div className="asgn-exam-item"><span className="asgn-exam-lbl">{t('assignments.maxScore')}</span><span className="asgn-exam-val">🎯 {a.totalMarks} pts</span></div>
                        </div>
                        {a.materialsCovered && (
                          <div className="asgn-materials-covered">
                            <h4>📚 {t('assignments.material')}</h4>
                            <p>{a.materialsCovered}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {!a.isAnnouncement && (
                      <div className="asgn-meta-grid">
                        <div className="asgn-meta-item"><span className="asgn-meta-label">{t('assignments.maxScore')}</span><span className="asgn-meta-val">{a.totalMarks} pts</span></div>
                        <div className="asgn-meta-item"><span className="asgn-meta-label">{t('common.semester')}</span><span className="asgn-meta-val">{a.semester} {a.year}</span></div>
                        <div className="asgn-meta-item"><span className="asgn-meta-label">Submission</span><span className="asgn-meta-val">{SUBMISSION_ICONS[a.submissionType]} {SUBMISSION_LABELS[a.submissionType]}</span></div>
                      </div>
                    )}

                    {!a.isAnnouncement && a.submissionType !== 'upload' && a.submissionType !== 'none' && (
                      <div className="asgn-submit-box">
                        <h4>📬 How to Submit</h4>
                        {a.submissionDetails && <p className="asgn-submit-details">{a.submissionDetails}</p>}
                        {a.submissionLink && <a href={a.submissionLink} target="_blank" rel="noopener noreferrer" className="asgn-submit-link">🔗 Open Submission Portal</a>}
                      </div>
                    )}

                    {!a.isAnnouncement && a.submissionType === 'upload' && (
                      <div className="asgn-upload-zone">
                        <h4>📤 {t('assignments.submitAssignment')}</h4>
                        {sub?.existing && !sub?.done && (
                          <div className="asgn-already-submitted">
                            <div className="asgn-already-icon">✅</div>
                            <div>
                              <p className="asgn-already-title">{t('assignments.submitted')}</p>
                              <p className="asgn-already-file">📎 {sub.existing.fileName}</p>
                              <p className="asgn-already-date">Submitted {new Date(sub.existing.submittedAt).toLocaleString('en-GB')}</p>
                              {sub.existing.feedback && <div className="asgn-feedback-box"><span className="asgn-feedback-label">📝 Feedback:</span><span className="asgn-feedback-text">{sub.existing.feedback}</span></div>}
                              {sub.existing.marks != null && <div className="asgn-marks-box">🎯 Marks: <strong>{sub.existing.marks} / {a.totalMarks}</strong></div>}
                              <a href={`${API_URL}/api/submissions/download/${sub.existing._id}`} className="asgn-download-own" target="_blank" rel="noopener noreferrer">📥 Download my submission</a>
                            </div>
                          </div>
                        )}
                        {sub?.done && <div className="asgn-upload-success"><span>🎉</span><p>{t('assignments.submitSuccess')}</p></div>}
                        {!isOverdue && !sub?.done && (
                          <div className="asgn-uploader">
                            <label className={`asgn-file-drop ${sub?.file ? 'has-file' : ''}`} htmlFor={`file-${a._id}`}>
                              <input id={`file-${a._id}`} type="file" accept=".pdf,.doc,.docx,.zip" style={{ display:'none' }} onChange={e => handleFileSelect(a._id, e.target.files[0])} />
                              {sub?.file ? (
                                <><span className="asgn-file-icon">📎</span><span className="asgn-file-name">{sub.file.name}</span><span className="asgn-file-size">({(sub.file.size/1024/1024).toFixed(2)} MB)</span></>
                              ) : (
                                <><span className="asgn-file-icon">📁</span><span className="asgn-file-prompt">{t('uploadMaterial.chooseFile')}</span><span className="asgn-file-hint">PDF, DOC, DOCX, ZIP — max 20 MB</span></>
                              )}
                            </label>
                            {sub?.uploadError && <p className="asgn-upload-error">⚠️ {sub.uploadError}</p>}
                            <button className="asgn-upload-btn" disabled={!sub?.file || sub?.uploading} onClick={() => handleUpload(a._id)}>
                              {sub?.uploading ? <><span className="asgn-btn-spinner" /> {t('assignments.uploading')}</> : `📤 ${t('assignments.submitAssignment')}`}
                            </button>
                          </div>
                        )}
                        {isOverdue && !sub?.existing && !sub?.done && (
                          <div className="asgn-overdue-note"><span>🔒</span><p>{t('assignments.closed')}</p></div>
                        )}
                      </div>
                    )}

                    {a.fileName && (
                      <div className="asgn-attachment">
                        <h4>📎 {a.isAnnouncement ? 'Reference File' : 'Assignment File'}</h4>
                        <a href={`${API_URL}/api/assignments/download/${a._id}`} className="asgn-download-btn" target="_blank" rel="noopener noreferrer">
                          📥 Download: {a.fileName}{a.fileSize ? ` (${(a.fileSize/1024/1024).toFixed(2)} MB)` : ''}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Assignments;

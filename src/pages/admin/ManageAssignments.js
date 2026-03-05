import React, { useState, useEffect, useCallback } from 'react';
import { assignmentAPI, courseAPI, submissionAPI, authAPI, pageCache } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './ManageAssignments.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SUBMISSION_TYPES = [
  { value: 'none',    label: '🚫 No Submission',      hint: 'Announcement only — no submission required' },
  { value: 'link',    label: '🔗 Online Link',         hint: 'Students submit via a URL (Moodle, Google Classroom, etc.)' },
  { value: 'email',   label: '📧 Email',               hint: 'Students email their submission to you' },
  { value: 'upload',  label: '📤 File Upload',         hint: 'Students upload a file directly on the portal' },
  { value: 'inclass', label: '🏫 In-Class',            hint: 'Students hand in physically during class' },
  { value: 'other',   label: '📋 Other',               hint: 'Custom submission method described below' },
];

const ManageAssignments = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'quizzes'
  const [form, setForm] = useState({
    course: '', title: '', description: '',
    submissionType: 'link', submissionDetails: '', submissionLink: '',
    deadline: '', totalMarks: '100', semester: 'Spring', year: String(new Date().getFullYear()),
  });

  // Submissions panel
  const [subPanel, setSubPanel] = useState(null);       // assignmentId being viewed
  const [subAssignment, setSubAssignment] = useState(null); // full assignment object for active panel
  const [submissions, setSubmissions] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState({}); // { [subId]: { feedback, marks, saving } }
  const [markingAll, setMarkingAll] = useState(false);
  const [markAllResult, setMarkAllResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await pageCache(`assignments:${user?._id}`, async () => {
        const [asgRes, crsRes, meRes] = await Promise.all([
          assignmentAPI.getStaffAssignments(),
          courseAPI.getAllCourses(),
          authAPI.getMe(),
        ]);
        const allCourses = crsRes.data || [];
        const freshUser = meRes.data;
        const filteredCourses = isSuperAdmin(freshUser)
          ? allCourses
          : (() => {
              const ids = new Set((freshUser?.assignedCourses || []).map(c => (c._id || c).toString()));
              return ids.size > 0 ? allCourses.filter(c => ids.has(c._id?.toString())) : [];
            })();
        return { assignments: asgRes.data || [], courses: filteredCourses };
      }, (data) => {
        setAssignments(data.assignments);
        setCourses(data.courses);
        setLoading(false);
      });
    } catch (e) {
      setError('Failed to load data');
      setLoading(false);
    }
  }, [user?._id]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const resetForm = (tab) => {
    const isQuiz = (tab || activeTab) === 'quizzes';
    setForm({
      course: '', title: '', description: '',
      submissionType: isQuiz ? 'none' : 'link',
      submissionDetails: '', submissionLink: '',
      deadline: '', totalMarks: '100', semester: 'Spring', year: String(new Date().getFullYear()),
      isAnnouncement: isQuiz,
      examType: isQuiz ? 'quiz' : 'none',
      materialsCovered: '', examDuration: '', examLocation: '',
    });
    setFile(null); setEditId(null); setError(''); setSuccess('');
  };

  const openCreate = () => { resetForm(activeTab); setShowForm(true); };
  const openEdit = (a) => {
    const deadlineLocal = a.deadline
      ? new Date(new Date(a.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
    setForm({
      course: a.course?._id || a.course || '',
      title: a.title || '',
      description: a.description || '',
      submissionType: a.submissionType || 'link',
      submissionDetails: a.submissionDetails || '',
      submissionLink: a.submissionLink || '',
      deadline: deadlineLocal,
      totalMarks: String(a.totalMarks || 100),
      semester: a.semester || 'Spring',
      year: String(a.year || new Date().getFullYear()),
      isAnnouncement: !!a.isAnnouncement,
      examType: a.examType || 'none',
      materialsCovered: a.materialsCovered || '',
      examDuration: a.examDuration ? String(a.examDuration) : '',
      examLocation: a.examLocation || '',
    });
    setFile(null); setEditId(a._id); setShowForm(true); setError(''); setSuccess('');
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.course) return setError('Please select a course');
    if (!form.deadline) return setError('Please set a deadline');
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);

      if (editId) {
        await assignmentAPI.update(editId, fd);
        setSuccess('✅ Assignment updated!');
      } else {
        await assignmentAPI.create(fd);
        setSuccess('✅ Assignment created & students notified!');
      }
      await load();
      setTimeout(() => { setShowForm(false); resetForm(); }, 1800);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assignment?')) return;
    setDeleting(id);
    try {
      await assignmentAPI.delete(id);
      setAssignments(p => p.filter(a => a._id !== id));
    } catch (e) {
      setError('Failed to delete assignment');
    } finally {
      setDeleting(null);
    }
  };

  const getDeadlineColor = (deadline) => {
    const diff = new Date(deadline) - new Date();
    if (diff < 0) return '#ef4444';
    if (diff < 86400000) return '#f97316';
    if (diff < 259200000) return '#f59e0b';
    return '#22c55e';
  };

  const openSubmissions = async (a) => {
    if (subPanel === a._id) { setSubPanel(null); setSubAssignment(null); return; }
    setSubPanel(a._id);
    setSubAssignment(a);
    setMarkAllResult('');
    setSubLoading(true);
    setSubmissions([]);
    try {
      const r = await submissionAPI.getByAssignment(a._id);
      setSubmissions(r.data || []);
      const fs = {};
      (r.data || []).forEach(s => { fs[s._id] = { feedback: s.feedback || '', marks: s.marks ?? '', saving: false }; });
      setFeedbackState(fs);
    } catch { setSubmissions([]); }
    finally { setSubLoading(false); }
  };

  const saveFeedback = async (subId, totalMarks) => {
    const fs = feedbackState[subId];
    if (!fs) return;
    setFeedbackState(p => ({ ...p, [subId]: { ...p[subId], saving: true } }));
    try {
      await submissionAPI.saveFeedback(subId, {
        feedback: fs.feedback,
        marks: fs.marks !== '' ? Number(fs.marks) : null,
      });
      setFeedbackState(p => ({ ...p, [subId]: { ...p[subId], saving: false } }));
      setSubmissions(prev => prev.map(s => s._id === subId
        ? { ...s, feedback: fs.feedback, marks: fs.marks !== '' ? Number(fs.marks) : null, status: fs.marks !== '' ? 'graded' : 'reviewed' }
        : s
      ));
    } catch {
      setFeedbackState(p => ({ ...p, [subId]: { ...p[subId], saving: false } }));
    }
  };

  const handleMarkAllReviewed = async () => {
    if (!subPanel) return;
    if (!window.confirm('Mark all unreviewed submissions for this assignment as "Reviewed"?')) return;
    setMarkingAll(true); setMarkAllResult('');
    try {
      const r = await submissionAPI.markAllReviewed(subPanel);
      setMarkAllResult(`✅ ${r.data.message}`);
      // refresh submissions list
      const updated = await submissionAPI.getByAssignment(subPanel);
      setSubmissions(updated.data || []);
      const fs = {};
      (updated.data || []).forEach(s => { fs[s._id] = { feedback: s.feedback || '', marks: s.marks ?? '', saving: false }; });
      setFeedbackState(fs);
    } catch (e) {
      setMarkAllResult(`⚠️ ${e.response?.data?.message || 'Failed to mark submissions'}`);
    } finally { setMarkingAll(false); }
  };

  const handleDownloadSingle = async (subId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/submissions/download/${subId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.message || 'Download failed');
        return;
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName || 'submission';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  };

  const handleDownloadAll = async () => {
    if (!subPanel) return;
    try {
      const token = localStorage.getItem('token');
      const url = `${API_URL}/api/submissions/assignment/${subPanel}/download-all`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.message || 'Download failed');
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match ? match[1] : 'submissions.zip';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  };

  if (loading) return (
    <div className="ma-page">
      <div className="ma-loader"><div className="ma-spinner" /><p>Loading…</p></div>
    </div>
  );

  // Filter list by active tab
  const listToShow = assignments.filter(a =>
    activeTab === 'quizzes'
      ? a.examType === 'quiz'
      : a.examType !== 'quiz'
  );

  return (
    <div className="ma-page">
      <div className="ma-header">
        <div>
          <h1>{activeTab === 'quizzes' ? '📋 Manage Quizzes' : '📝 Manage Assignments'}</h1>
          <p>{activeTab === 'quizzes'
            ? 'Create and announce quizzes — auto-added to student classwork grades'
            : 'Create, edit and track assignments for your courses'}</p>
        </div>
        <button className="ma-btn-create" onClick={openCreate}>
          {activeTab === 'quizzes' ? '+ New Quiz' : '+ New Assignment'}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="grade-mode-toggle" style={{ marginBottom: 16 }}>
        <button className={`mode-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => { setActiveTab('assignments'); setShowForm(false); resetForm('assignments'); }}>
          📝 Assignments
          <span style={{ marginLeft:6, fontSize:11, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'1px 7px' }}>
            {assignments.filter(a => a.examType !== 'quiz').length}
          </span>
        </button>
        <button className={`mode-btn ${activeTab === 'quizzes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('quizzes'); setShowForm(false); resetForm('quizzes'); }}>
          📋 Quizzes
          <span style={{ marginLeft:6, fontSize:11, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'1px 7px' }}>
            {assignments.filter(a => a.examType === 'quiz').length}
          </span>
        </button>
      </div>

      {error && !showForm && <div className="ma-alert ma-alert--err">{error}</div>}

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div className="ma-form-card">
          <div className="ma-form-header">
            <h2>{editId
              ? (activeTab === 'quizzes' ? '✏️ Edit Quiz' : '✏️ Edit Assignment')
              : (activeTab === 'quizzes' ? '➕ New Quiz' : '➕ New Assignment')}
            </h2>
            <button className="ma-close-btn" onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
          </div>

          {error && <div className="ma-alert ma-alert--err">{error}</div>}
          {success && <div className="ma-alert ma-alert--ok">{success}</div>}

          <form onSubmit={handleSubmit} className="ma-form">
            <div className="ma-form-grid">
              {/* Course */}
              <div className="ma-field ma-field--full">
                <label>Course *</label>
                <select name="course" value={form.course} onChange={handleChange} required>
                  <option value="">— Select course —</option>
                  {courses.map(c => (
                    <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="ma-field ma-field--full">
                <label>Assignment Title *</label>
                <input name="title" value={form.title} onChange={handleChange} required placeholder="e.g., Week 3 Lab Report" />
              </div>

              {/* Description */}
              <div className="ma-field ma-field--full">
                <label>Description / Instructions *</label>
                <textarea name="description" value={form.description} onChange={handleChange} required rows={4} placeholder="Describe what students need to do..." />
              </div>

              {/* ── Exam Announcement toggle ── */}
              <div className="ma-field ma-field--full">
                <label className="ma-checkbox-label">
                  <input type="checkbox" name="isAnnouncement" checked={!!form.isAnnouncement} onChange={handleChange} />
                  <span>📅 This is an Exam / Quiz Announcement (no submission required)</span>
                </label>
              </div>

              {/* Exam fields — only show when announcement */}
              {form.isAnnouncement && (
                <>
                  <div className="ma-field">
                    <label>Exam Type *</label>
                    <select name="examType" value={form.examType} onChange={handleChange}>
                      <option value="none">— Select type —</option>
                      <option value="quiz">📋 Quiz</option>
                      <option value="midterm">📄 Midterm</option>
                      <option value="final">🎓 Final Exam</option>
                    </select>
                  </div>
                  <div className="ma-field">
                    <label>Duration (minutes)</label>
                    <input name="examDuration" value={form.examDuration} onChange={handleChange} type="number" min="1" placeholder="e.g. 90" />
                  </div>
                  <div className="ma-field ma-field--full">
                    <label>Location / Room</label>
                    <input name="examLocation" value={form.examLocation} onChange={handleChange} placeholder="e.g. Amphitheatre A, Room 201" />
                  </div>
                  <div className="ma-field ma-field--full">
                    <label>Materials / Topics Covered</label>
                    <textarea name="materialsCovered" value={form.materialsCovered} onChange={handleChange} rows={3} placeholder="e.g. Chapters 1-4, Lectures 1-6, Data Structures..." />
                  </div>
                </>
              )}

              {/* Submission Type — hide for announcements */}
              {!form.isAnnouncement && (
                <div className="ma-field">
                  <label>Submission Method *</label>
                  <select name="submissionType" value={form.submissionType} onChange={handleChange}>
                    {SUBMISSION_TYPES.filter(st => st.value !== 'none').map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                  <span className="ma-field-hint">{SUBMISSION_TYPES.find(st => st.value === form.submissionType)?.hint}</span>
                </div>
              )}

              {/* Deadline */}
              <div className="ma-field">
                <label>Deadline *</label>
                <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleChange} required />
              </div>

              {/* Submission Details */}
              <div className="ma-field ma-field--full">
                <label>Submission Details</label>
                <input name="submissionDetails" value={form.submissionDetails} onChange={handleChange}
                  placeholder="e.g., email to doctor@hnu.edu  or  submit on Moodle course page" />
              </div>

              {/* Submission Link */}
              <div className="ma-field ma-field--full">
                <label>Submission Link (optional)</label>
                <input name="submissionLink" value={form.submissionLink} onChange={handleChange}
                  type="url" placeholder="https://moodle.hnu.edu/assignment/xyz" />
              </div>

              {/* Total Marks */}
              <div className="ma-field">
                <label>Total Marks</label>
                <input name="totalMarks" value={form.totalMarks} onChange={handleChange} type="number" min="1" max="1000" />
              </div>

              {/* Semester / Year */}
              <div className="ma-field">
                <label>Semester</label>
                <select name="semester" value={form.semester} onChange={handleChange}>
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>

              <div className="ma-field">
                <label>Year</label>
                <input name="year" value={form.year} onChange={handleChange} type="number" min="2020" max="2035" />
              </div>

              {/* File */}
              <div className="ma-field ma-field--full">
                <label>Attach File (optional)</label>
                <div className="ma-file-zone" onClick={() => document.getElementById('ma-file-input').click()}>
                  <input id="ma-file-input" type="file" style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.xlsx"
                    onChange={e => setFile(e.target.files[0] || null)} />
                  {file
                    ? <><span>📎</span><span>{file.name}</span><span className="ma-file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span></>
                    : <><span>📁</span><span>Click to attach a file</span><span className="ma-file-hint">PDF, DOC, PPT, ZIP…</span></>
                  }
                </div>
              </div>
            </div>

            <div className="ma-form-actions">
              <button type="button" className="ma-btn-cancel" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" className="ma-btn-submit" disabled={submitting}>
                {submitting ? 'Saving…' : editId
                  ? (activeTab === 'quizzes' ? '💾 Update Quiz' : '💾 Update Assignment')
                  : (activeTab === 'quizzes' ? '📋 Create Quiz & Notify' : '📤 Create & Notify Students')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── List ── */}
      {listToShow.length === 0 ? (
        <div className="ma-empty">
          <span>{activeTab === 'quizzes' ? '📋' : '📭'}</span>
          <h3>No {activeTab === 'quizzes' ? 'quizzes' : 'assignments'} yet</h3>
          <p>{activeTab === 'quizzes'
            ? 'Create a quiz — it will be announced to students and auto-added to their classwork grades.'
            : 'Create your first assignment and students will be notified automatically.'}
          </p>
          <button className="ma-btn-create" onClick={openCreate}>
            {activeTab === 'quizzes' ? '+ Create Quiz' : '+ Create Assignment'}
          </button>
        </div>
      ) : (
        <div className="ma-list">
          {listToShow.map(a => (
            <div key={a._id}>
              <div className="ma-row">
                <div className="ma-row-course">
                  <span className="ma-course-chip">{a.course?.courseCode}</span>
                  <span className="ma-course-name">{a.course?.courseName}</span>
                </div>
                <div className="ma-row-main">
                  <p className="ma-row-title">{a.title}</p>
                  <p className="ma-row-desc">{a.description?.slice(0, 90)}{a.description?.length > 90 ? '…' : ''}</p>
                </div>
                <div className="ma-row-deadline">
                  <span className="ma-deadline-dot" style={{ background: getDeadlineColor(a.deadline) }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(a.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="ma-row-actions">
                  {a.submissionType === 'upload' && (
                    <button className={`ma-btn-subs ${subPanel === a._id ? 'active' : ''}`} onClick={() => openSubmissions(a)}>
                      📥 Submissions
                    </button>
                  )}
                  <button className="ma-btn-edit" onClick={() => openEdit(a)}>✏️ Edit</button>
                  <button className="ma-btn-del" disabled={deleting === a._id} onClick={() => handleDelete(a._id)}>
                    {deleting === a._id ? '…' : '🗑️'}
                  </button>
                </div>
              </div>

              {/* Submissions Panel */}
              {subPanel === a._id && (
                <div className="ma-subs-panel">
                  <div className="ma-subs-header">
                    <h3>📥 Submissions for: {a.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ma-subs-count">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
                      {new Date(a.deadline) < new Date() && (
                        <>
                          <button
                            className="ma-btn-mark-all"
                            onClick={handleMarkAllReviewed}
                            disabled={markingAll || submissions.every(s => s.status !== 'submitted')}
                            title="Mark all unreviewed submissions as Reviewed"
                          >
                            {markingAll ? '⏳ Marking…' : '✅ Mark All Reviewed'}
                          </button>
                          <button
                            className="ma-btn-download-all"
                            onClick={handleDownloadAll}
                            disabled={submissions.length === 0}
                            title="Download all submitted files as a ZIP archive"
                          >
                            📦 Download All (.zip)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {markAllResult && (
                    <div className={`ma-alert ${markAllResult.startsWith('✅') ? 'ma-alert--ok' : 'ma-alert--err'}`} style={{ margin: '8px 0' }}>
                      {markAllResult}
                    </div>
                  )}

                  {subLoading ? (
                    <div className="ma-subs-loading"><div className="ma-spinner" /><span>Loading…</span></div>
                  ) : submissions.length === 0 ? (
                    <div className="ma-subs-empty">📭 No submissions yet</div>
                  ) : (
                    <div className="ma-subs-list">
                      {submissions.map(s => {
                        const fs = feedbackState[s._id] || {};
                        const statusColor = s.status === 'graded' ? '#22c55e' : s.status === 'reviewed' ? '#6366f1' : '#f59e0b';
                        return (
                          <div key={s._id} className="ma-sub-row">
                            <div className="ma-sub-info">
                              <p className="ma-sub-name">{s.student?.firstName} {s.student?.lastName}</p>
                              <p className="ma-sub-id">{s.student?.studentId}</p>
                              <p className="ma-sub-file">📎 {s.fileName}</p>
                              <p className="ma-sub-date">🕐 {new Date(s.submittedAt).toLocaleString('en-GB')}</p>
                              <span className="ma-sub-status" style={{ color: statusColor, background: statusColor + '18', border: `1px solid ${statusColor}30` }}>
                                {s.status}
                              </span>
                            </div>
                            <div className="ma-sub-actions">
                              <button
                                className="ma-sub-download"
                                onClick={() => handleDownloadSingle(s._id, s.fileName)}
                              >📥 Download</button>
                              <div className="ma-sub-feedback">
                                <input
                                  type="number"
                                  className="ma-sub-marks"
                                  placeholder={`Marks /${a.totalMarks}`}
                                  min="0"
                                  max={a.totalMarks}
                                  value={fs.marks ?? ''}
                                  onChange={e => setFeedbackState(p => ({ ...p, [s._id]: { ...p[s._id], marks: e.target.value } }))}
                                />
                                <textarea
                                  className="ma-sub-feedback-txt"
                                  placeholder="Feedback (optional)…"
                                  rows={2}
                                  value={fs.feedback ?? ''}
                                  onChange={e => setFeedbackState(p => ({ ...p, [s._id]: { ...p[s._id], feedback: e.target.value } }))}
                                />
                                <button
                                  className="ma-sub-save"
                                  disabled={fs.saving}
                                  onClick={() => saveFeedback(s._id, a.totalMarks)}
                                >
                                  {fs.saving ? 'Saving…' : '💾 Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageAssignments;


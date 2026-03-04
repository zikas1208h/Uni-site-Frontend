/**
 * University Portal System — Manage Staff (Super Admin Only)
 * Copyright (c) 2026 Mazen Hossam. All Rights Reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { staffAPI, courseAPI } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import './ManageStaff.css';

// ── Constants ────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  superadmin: { label: 'Super Admin', icon: '👑', color: '#f59e0b', desc: 'Full access to everything' },
  doctor:     { label: 'Doctor',      icon: '🎓', color: '#6366f1', desc: 'Manage their assigned courses, grades, materials' },
  assistant:  { label: 'Assistant',   icon: '📋', color: '#22c55e', desc: 'View students, upload materials, manage grades for assigned courses' },
};

// Permissions superadmin can toggle for doctors & assistants
const PERMISSION_CONFIG = [
  { key: 'canManageGrades',            label: 'Manage Grades',               icon: '📝', desc: 'Add / edit grades for enrolled students',                defaultOn: true  },
  { key: 'canUploadMaterials',         label: 'Upload Materials',             icon: '📤', desc: 'Upload course files and materials',                      defaultOn: true  },
  { key: 'canViewStudents',            label: 'View Students',                icon: '👨‍🎓', desc: 'Browse student profiles and enrollment info',           defaultOn: true  },
  { key: 'canViewAllStudents',         label: 'View ALL Students',            icon: '🌐', desc: 'See every student in the system (not just course-linked)', defaultOn: false },
  { key: 'canEditCourse',              label: 'Edit Course Details',          icon: '✏️', desc: 'Edit course name, schedule, description etc.',           defaultOn: true  },
  { key: 'canMarkCourseStatus',        label: 'Mark Course as Completed',     icon: '✅', desc: 'Toggle a course between active / completed',             defaultOn: true  },
  { key: 'canResetPasswords',          label: 'Reset Student Passwords',      icon: '🔑', desc: 'Reset passwords for students in their courses',          defaultOn: false },
  { key: 'canManageStudentEnrollment', label: 'Manage Student Enrollment',    icon: '📋', desc: 'Add or remove students from courses',                    defaultOn: false },
];

const DEFAULT_PERMISSIONS = Object.fromEntries(PERMISSION_CONFIG.map(p => [p.key, p.defaultOn]));

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', studentId: '',
  password: '', role: 'doctor', assignedCourses: [],
  linkedDoctors: [], extraCourses: [],
  permissions: { ...DEFAULT_PERMISSIONS },
};

// ── Helper ───────────────────────────────────────────────────────────────────
const roleLabel = (role) => ROLE_CONFIG[role]?.label || role;
const roleColor = (role) => ROLE_CONFIG[role]?.color || '#94a3b8';

// Normalise year: handles academic year 1-4 OR old calendar years 2024-2027
const getAcademicYear = (year) => {
  if (year >= 1 && year <= 4) return year;
  // calendar year mapping: 2024→1, 2025→2, 2026→3, 2027→4
  if (year >= 2024 && year <= 2027) return year - 2023;
  return year;
};

export default function ManageStaff() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate  = useNavigate();

  const [staff,   setStaff]   = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [search,    setSearch]    = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showPass,  setShowPass]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [courseYearFilter, setCourseYearFilter] = useState('all');
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [semesterResetting, setSemesterResetting] = useState(false);

  // Guard
  useEffect(() => {
    if (user && !isSuperAdmin(user)) navigate('/admin/dashboard');
  }, [user, navigate]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [staffRes, coursesRes] = await Promise.all([
        staffAPI.getAll(),
        courseAPI.getAllCourses(),
      ]);
      setStaff(staffRes.data.data || []);
      setCourses(coursesRes.data || []);
    } catch (e) {
      setError('Failed to load staff data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const notify = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowPass(false);
    setSelectedDoctors([]);
    setCourseYearFilter('all');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditId(s._id);
    const linkedDocIds = (s.linkedDoctors || []).map(d => (d._id || d).toString());
    // extraCourses may be populated {_id, courseCode} objects OR raw ObjectId strings — normalize both
    const rawExtraCourses = (s.extraCourses || []).map(c =>
      typeof c === 'object' && c !== null ? (c._id || c).toString() : c.toString()
    );
    // assignedCourses for doctors — same normalization
    const rawAssignedCourses = s.role === 'assistant' ? [] : (s.assignedCourses || []).map(c =>
      typeof c === 'object' && c !== null ? (c._id || c).toString() : c.toString()
    );
    setForm({
      firstName: s.firstName,
      lastName:  s.lastName,
      email:     s.email,
      studentId: s.studentId,
      password:  '',
      role:      s.role,
      assignedCourses: rawAssignedCourses,
      linkedDoctors:   linkedDocIds,
      extraCourses:    rawExtraCourses,
      permissions: { ...DEFAULT_PERMISSIONS, ...(s.permissions || {}) },
    });
    setSelectedDoctors(linkedDocIds);
    setShowPass(false);
    setCourseYearFilter('all');
    setShowForm(true);
  };

  const toggleCourse = (cId) => {
    const id = (cId?._id || cId).toString();
    if (form.role === 'assistant') {
      setForm(f => {
        const list = f.extraCourses.map(x => (x?._id || x).toString());
        const has  = list.includes(id);
        return { ...f, extraCourses: has ? list.filter(x => x !== id) : [...list, id] };
      });
    } else {
      setForm(f => {
        const list = f.assignedCourses.map(x => (x?._id || x).toString());
        const has  = list.includes(id);
        return { ...f, assignedCourses: has ? list.filter(x => x !== id) : [...list, id] };
      });
    }
  };

  // Toggle a doctor link for an assistant — one press to link, one press to unlink
  const toggleDoctor = (doctor) => {
    const docId = (doctor._id || doctor).toString();
    setSelectedDoctors(prev => {
      const isSelected = prev.includes(docId);
      const next = isSelected ? prev.filter(id => id !== docId) : [...prev, docId];
      setForm(f => ({ ...f, linkedDoctors: next }));
      return next;
    });
  };

  // Semester reset: unlink all assistants from all doctors
  const handleSemesterReset = async () => {
    if (!window.confirm('This will unlink ALL assistants from their doctors and clear their course assignments for the new semester. Continue?')) return;
    setSemesterResetting(true);
    try {
      const res = await staffAPI.semesterReset();
      notify(res.data.message || 'Semester reset complete!');
      fetchAll();
    } catch (e) {
      notify(e.response?.data?.message || 'Reset failed.', true);
    } finally {
      setSemesterResetting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.studentId) {
      notify('Please fill in all required fields.', true); return;
    }
    if (!editId && !form.password) {
      notify('Password is required for new staff.', true); return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, studentId: form.studentId,
        role: form.role,
      };
      if (form.password) payload.password = form.password;

      if (form.role === 'assistant') {
        payload.linkedDoctors = form.linkedDoctors;
        payload.extraCourses  = form.extraCourses;
      } else {
        payload.assignedCourses = form.assignedCourses;
      }
      // Include permissions for doctor/assistant (superadmin has all by default)
      if (form.role !== 'superadmin') {
        payload.permissions = form.permissions;
      }

      if (editId) {
        await staffAPI.update(editId, payload);
        notify('Staff member updated!');
      } else {
        await staffAPI.create(payload);
        notify('Staff member created!');
      }
      setShowForm(false);
      fetchAll();
    } catch (e) {
      notify(e.response?.data?.message || 'Failed to save.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await staffAPI.remove(id);
      notify('Staff member deleted.');
      setConfirmDelete(null);
      fetchAll();
    } catch (e) {
      notify(e.response?.data?.message || 'Failed to delete.', true);
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    const matchesRole = filterRole === 'all' || s.role === filterRole;
    const q = search.toLowerCase();
    const matchesSearch = !q || `${s.firstName} ${s.lastName} ${s.email} ${s.studentId}`.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  // ── Role counts ──────────────────────────────────────────────────────────
  const counts = staff.reduce((acc, s) => { acc[s.role] = (acc[s.role] || 0) + 1; return acc; }, {});

  if (loading) {
    return (
      <div className="ms-loading">
        <div className="ms-spinner" />
        <p>Loading staff…</p>
      </div>
    );
  }

  return (
    <div className="ms-page">

      {/* ── Header ── */}
      <div className="ms-header">
        <div>
          <h1>Manage Staff</h1>
          <p className="ms-subtitle">Control who has access and what they can do</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="ms-btn-semester-reset" onClick={handleSemesterReset} disabled={semesterResetting}>
            {semesterResetting ? '⏳ Resetting…' : '🔄 New Semester Reset'}
          </button>
          <button className="ms-btn-primary" onClick={openCreate}>+ Add Staff Member</button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error   && <div className="ms-notif ms-notif-error">{error}</div>}
      {success && <div className="ms-notif ms-notif-success">{success}</div>}

      {/* ── Role summary cards ── */}
      <div className="ms-role-summary">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
          <div key={role} className="ms-role-card" style={{ '--rc': cfg.color }}
            onClick={() => setFilterRole(filterRole === role ? 'all' : role)}>
            <span className="ms-role-icon">{cfg.icon}</span>
            <div>
              <p className="ms-role-count">{counts[role] || 0}</p>
              <p className="ms-role-name">{cfg.label}</p>
            </div>
            <p className="ms-role-desc">{cfg.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="ms-filters">
        <div className="ms-search-wrap">
          <span className="ms-search-icon">🔍</span>
          <input
            className="ms-search"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="ms-clear-search" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="ms-filter-btns">
          {['all', 'superadmin', 'doctor', 'assistant'].map(r => (
            <button
              key={r}
              className={`ms-filter-btn ${filterRole === r ? 'active' : ''}`}
              style={filterRole === r && r !== 'all' ? { background: roleColor(r) + '22', color: roleColor(r), borderColor: roleColor(r) + '55' } : {}}
              onClick={() => setFilterRole(r)}
            >
              {r === 'all' ? 'All' : ROLE_CONFIG[r]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="ms-empty">
          <span>👤</span>
          <p>No staff members found.</p>
          {!search && <button className="ms-btn-primary" onClick={openCreate}>Add First Staff Member</button>}
        </div>
      ) : (
        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>ID / Email</th>
                <th>Assigned Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s._id}>
                  <td>
                    <div className="ms-name-cell">
                      <div className="ms-avatar" style={{ background: roleColor(s.role) + '22', color: roleColor(s.role) }}>
                        {s.firstName?.[0]}{s.lastName?.[0]}
                      </div>
                      <div>
                        <p className="ms-name">{s.firstName} {s.lastName}</p>
                        {s._id === user?._id && <span className="ms-you-tag">You</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="ms-role-badge" style={{ background: roleColor(s.role) + '22', color: roleColor(s.role), borderColor: roleColor(s.role) + '55' }}>
                      {ROLE_CONFIG[s.role]?.icon} {roleLabel(s.role)}
                    </span>
                  </td>
                  <td>
                    <p className="ms-id">{s.studentId}</p>
                    <p className="ms-email">{s.email}</p>
                  </td>
                  <td>
                    {isSuperAdmin(s) ? (
                      <span className="ms-no-courses">All courses</span>
                    ) : s.role === 'assistant' ? (
                      <div>
                        {/* Show linked doctors */}
                        {(s.linkedDoctors || []).length > 0 && (
                          <div className="ms-courses-list" style={{ marginBottom: 4 }}>
                            {(s.linkedDoctors || []).slice(0, 2).map(d => (
                              <span key={d._id || d} className="ms-course-chip" style={{ background: '#6366f115', color: '#6366f1', borderColor: '#6366f130' }}>
                                🎓 {d.firstName || 'Dr.'} {d.lastName || ''}
                              </span>
                            ))}
                            {(s.linkedDoctors || []).length > 2 && (
                              <span className="ms-course-chip ms-course-chip--more">+{s.linkedDoctors.length - 2} doctors</span>
                            )}
                          </div>
                        )}
                        {/* Show extra courses */}
                        {(s.extraCourses || []).length > 0 && (
                          <div className="ms-courses-list">
                            {(s.extraCourses || []).slice(0, 2).map(c => (
                              <span key={c._id || c} className="ms-course-chip">
                                {c.courseCode || 'Course'}
                              </span>
                            ))}
                            {(s.extraCourses || []).length > 2 && (
                              <span className="ms-course-chip ms-course-chip--more">+{s.extraCourses.length - 2} extra</span>
                            )}
                          </div>
                        )}
                        {/* Effective total */}
                        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'block' }}>
                          ✅ {(s.assignedCourses || []).length} effective courses
                        </span>
                        {(s.linkedDoctors || []).length === 0 && (s.extraCourses || []).length === 0 && (
                          <span className="ms-no-courses">— none assigned —</span>
                        )}
                      </div>
                    ) : (
                      (s.assignedCourses || []).length === 0 ? (
                        <span className="ms-no-courses">— none —</span>
                      ) : (
                        <div className="ms-courses-list">
                          {(s.assignedCourses || []).slice(0, 3).map(c => (
                            <span key={c._id || c} className="ms-course-chip">
                              {c.courseCode || 'Course'}
                            </span>
                          ))}
                          {(s.assignedCourses || []).length > 3 && (
                            <span className="ms-course-chip ms-course-chip--more">
                              +{s.assignedCourses.length - 3}
                            </span>
                          )}
                        </div>
                      )
                    )}
                    {/* Permissions summary */}
                    {s.role !== 'superadmin' && s.permissions && (
                      <div className="ms-perm-chips">
                        {PERMISSION_CONFIG.filter(p => s.permissions[p.key] === false).map(p => (
                          <span key={p.key} className="ms-perm-chip off" title={p.label}>
                            {p.icon} {p.label}
                          </span>
                        ))}
                        {PERMISSION_CONFIG.every(p => s.permissions[p.key] !== false) && (
                          <span className="ms-perm-chip all-on">✓ All permissions on</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="ms-actions">
                      <button className="ms-btn-edit" onClick={() => openEdit(s)}>✏️ Edit</button>
                      {s._id !== user?._id && (
                        <button className="ms-btn-delete" onClick={() => setConfirmDelete(s._id)}>🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ Delete confirm modal ══ */}
      {confirmDelete && (
        <div className="ms-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="ms-confirm" onClick={e => e.stopPropagation()}>
            <h3>Delete Staff Member?</h3>
            <p>This action cannot be undone.</p>
            <div className="ms-confirm-btns">
              <button className="ms-btn-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="ms-btn-delete-confirm" disabled={saving} onClick={() => handleDelete(confirmDelete)}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Create / Edit modal ══ */}
      {showForm && (
        <div className="ms-overlay" onClick={e => { if (e.target.classList.contains('ms-overlay')) setShowForm(false); }}>
          <div className="ms-modal">
            <div className="ms-modal-header">
              <h2>{editId ? 'Edit Staff Member' : 'New Staff Member'}</h2>
              <button className="ms-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form className="ms-form" onSubmit={handleSubmit}>

              {/* Role selector */}
              <div className="ms-field">
                <label>Role *</label>
                <div className="ms-role-selector">
                  {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                    <button
                      key={role}
                      type="button"
                      className={`ms-role-opt ${form.role === role ? 'selected' : ''}`}
                      style={form.role === role ? { borderColor: cfg.color, background: cfg.color + '18' } : {}}
                      onClick={() => setForm(f => ({ ...f, role }))}
                    >
                      <span className="ms-role-opt-icon">{cfg.icon}</span>
                      <span className="ms-role-opt-label">{cfg.label}</span>
                      <span className="ms-role-opt-desc">{cfg.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name row */}
              <div className="ms-field-row">
                <div className="ms-field">
                  <label>First Name *</label>
                  <input type="text" placeholder="First name" value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div className="ms-field">
                  <label>Last Name *</label>
                  <input type="text" placeholder="Last name" value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>

              {/* Email + ID */}
              <div className="ms-field-row">
                <div className="ms-field">
                  <label>Email *</label>
                  <input type="email" placeholder="staff@hnu.edu" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="ms-field">
                  <label>Staff ID *</label>
                  <input type="text" placeholder="e.g. DR-001" value={form.studentId}
                    onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} required />
                </div>
              </div>

              {/* Password */}
              <div className="ms-field">
                <label>{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <div className="ms-pass-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder={editId ? 'Leave blank to keep current password' : 'Min 6 characters'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required={!editId}
                    minLength={editId ? 0 : 6}
                  />
                  <button type="button" className="ms-pass-toggle" onClick={() => setShowPass(p => !p)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Assigned courses (doctor / assistant only) */}
              {form.role !== 'superadmin' && (
                <div className="ms-field">
                  <label>
                    {form.role === 'assistant'
                      ? `Extra Courses (${form.extraCourses.length} additional — on top of linked doctors)`
                      : `Assigned Courses (${form.assignedCourses.length} selected)`}
                  </label>
                  <p className="ms-field-hint">
                    {form.role === 'doctor'
                      ? 'Doctor can manage grades, materials and update these courses.'
                      : 'Assistant can view, upload materials and manage grades for these courses.'}
                  </p>

                  {/* ── Doctor live-link section (assistants only) ── */}
                  {form.role === 'assistant' && (() => {
                    const doctors = staff.filter(s => s.role === 'doctor');
                    if (doctors.length === 0) return null;
                    return (
                      <div className="ms-doctor-inherit">
                        <div className="ms-doctor-inherit-header">
                          <span className="ms-doctor-inherit-icon">🔗</span>
                          <div>
                            <span className="ms-doctor-inherit-title">Link to Doctor(s)</span>
                            <span className="ms-doctor-inherit-hint"> — assistant stays live-linked all semester; any change to a doctor's courses instantly applies</span>
                          </div>
                        </div>
                        <div className="ms-doctor-list">
                          {doctors.map(doc => {
                            const docIdStr = (doc._id || doc).toString();
                            const isSel = selectedDoctors.includes(docIdStr);
                            const docCourseCount = (doc.assignedCourses || []).length;
                            return (
                              <button
                                key={docIdStr}
                                type="button"
                                className={`ms-doctor-btn ${isSel ? 'selected' : ''}`}
                                onClick={() => toggleDoctor(doc)}
                              >
                                <span className="ms-doctor-avatar">{doc.firstName?.[0]}{doc.lastName?.[0]}</span>
                                <span className="ms-doctor-info">
                                  <span className="ms-doctor-name">Dr. {doc.firstName} {doc.lastName}</span>
                                  <span className="ms-doctor-courses">{docCourseCount} course{docCourseCount !== 1 ? 's' : ''}</span>
                                </span>
                                {isSel && <span className="ms-doctor-check">🔗</span>}
                              </button>
                            );
                          })}
                        </div>
                        {selectedDoctors.length > 0 && (
                          <p className="ms-doctor-note">
                            🔗 Linked to {selectedDoctors.length} doctor(s). The assistant will automatically see all course changes made to those doctors throughout the semester. Use the grid below to add <strong>extra</strong> courses.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Year filter tabs */}
                  <div className="ms-year-filter">
                    {['all', '1', '2', '3', '4'].map(y => (
                      <button
                        key={y}
                        type="button"
                        className={`ms-year-tab ${courseYearFilter === y ? 'active' : ''}`}
                        onClick={() => setCourseYearFilter(y)}
                      >
                        {y === 'all' ? 'All Years' : `Year ${y}`}
                        <span className="ms-year-count">
                          {y === 'all'
                            ? courses.length
                            : courses.filter(c => String(getAcademicYear(c.year)) === y).length}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="ms-courses-grid">
                    {courses.length === 0 ? (
                      <p className="ms-no-courses">No courses available. Create courses first.</p>
                    ) : (
                      courses
                        .filter(c => courseYearFilter === 'all' || String(getAcademicYear(c.year)) === courseYearFilter)
                        .map(c => {
                          const courseIdStr = (c._id || c).toString();
                          const sel = form.role === 'assistant'
                            ? form.extraCourses.map(x => (x?._id || x).toString()).includes(courseIdStr)
                            : form.assignedCourses.map(x => (x?._id || x).toString()).includes(courseIdStr);
                          const academicYr = getAcademicYear(c.year);
                          return (
                            <button
                              key={courseIdStr}
                              type="button"
                              className={`ms-course-toggle ${sel ? 'selected' : ''}`}
                              onClick={() => toggleCourse(courseIdStr)}
                            >
                              <span className="ms-ct-code">{c.courseCode}</span>
                              <span className="ms-ct-name">{c.courseName}</span>
                              <span className="ms-ct-meta">
                                <span className="ms-ct-year">Yr {academicYr}</span>
                                <span className="ms-ct-credits">{c.credits} cr</span>
                              </span>
                              {sel && <span className="ms-ct-check">✓</span>}
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {form.role === 'superadmin' && (
                <div className="ms-superadmin-note">
                  👑 Super Admin has full access to all courses, students, grades, materials, staff, and settings. No course assignment needed.
                </div>
              )}

              {/* ── Permissions panel (doctor / assistant only) ── */}
              {form.role !== 'superadmin' && (
                <div className="ms-field">
                  <label>Feature Permissions</label>
                  <p className="ms-field-hint">Control exactly what this staff member can do. Create and delete courses are always superadmin-only.</p>
                  <div className="ms-permissions-grid">
                    {PERMISSION_CONFIG.map(p => {
                      const enabled = form.permissions[p.key] !== false ? true : false;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          className={`ms-perm-toggle ${enabled ? 'on' : 'off'}`}
                          onClick={() => setForm(f => ({
                            ...f,
                            permissions: { ...f.permissions, [p.key]: !enabled }
                          }))}
                        >
                          <span className="ms-perm-icon">{p.icon}</span>
                          <div className="ms-perm-info">
                            <span className="ms-perm-label">{p.label}</span>
                            <span className="ms-perm-desc">{p.desc}</span>
                          </div>
                          <span className={`ms-perm-status ${enabled ? 'on' : 'off'}`}>
                            {enabled ? '✓ On' : '✗ Off'}
                          </span>
                        </button>
                      );
                    })}
                    {/* Always-locked permissions */}
                    <div className="ms-perm-toggle locked">
                      <span className="ms-perm-icon">➕</span>
                      <div className="ms-perm-info">
                        <span className="ms-perm-label">Create Course</span>
                        <span className="ms-perm-desc">Create new courses in the system</span>
                      </div>
                      <span className="ms-perm-status locked">🔒 Superadmin only</span>
                    </div>
                    <div className="ms-perm-toggle locked">
                      <span className="ms-perm-icon">🗑️</span>
                      <div className="ms-perm-info">
                        <span className="ms-perm-label">Delete Course</span>
                        <span className="ms-perm-desc">Permanently remove a course</span>
                      </div>
                      <span className="ms-perm-status locked">🔒 Superadmin only</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="ms-form-footer">
                <button type="button" className="ms-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="ms-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update Staff Member' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


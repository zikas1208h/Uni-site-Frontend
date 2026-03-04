import React, { useState, useEffect, useRef } from 'react';
import { studentAPI, gradeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Profile.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const gradeClass = (g) => {
  if (!g) return '';
  const map = { 'A+': 'a-plus', 'A': 'a', 'A-': 'a-minus', 'B+': 'b-plus', 'B': 'b', 'B-': 'b-minus', 'C+': 'c-plus', 'C': 'c', 'C-': 'c-minus', 'D+': 'd-plus', 'D': 'd', 'F': 'f' };
  return 'grade-' + (map[g] || g.toLowerCase());
};

const Profile = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [gpaData, setGpaData] = useState({ gpa: 0, totalCredits: 0 });
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg]   = useState({ text: '', ok: true });
  const [pwdSaving, setPwdSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, gpaRes, gradesRes] = await Promise.all([
          studentAPI.getProfile(),
          gradeAPI.getGPA().catch(() => ({ data: { gpa: 0, totalCredits: 0 } })),
          gradeAPI.getStudentGrades().catch(() => ({ data: [] })),
        ]);
        setProfile(profileRes.data);
        setGpaData(gpaRes.data || { gpa: 0, totalCredits: 0 });
        setGrades(gradesRes.data || []);
      } catch (err) {
        console.error(err);
        setFetchError(err.response?.data?.message || err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const res = await studentAPI.uploadProfilePicture(formData);
      setProfile(res.data.user);
      setUploadMsg('Profile picture updated!');
    } catch (err) {
      setUploadMsg('Failed to upload. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdMsg({ text: '❌ New passwords do not match', ok: false }); return;
    }
    if (pwdForm.next.length < 6) {
      setPwdMsg({ text: '❌ Password must be at least 6 characters', ok: false }); return;
    }
    setPwdSaving(true);
    try {
      const res = await studentAPI.changePassword({ currentPassword: pwdForm.current, newPassword: pwdForm.next });
      setPwdMsg({ text: '✅ ' + res.data.message, ok: true });
      setPwdForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ text: '❌ ' + (err.response?.data?.message || 'Failed'), ok: false });
    }
    setPwdSaving(false);
    setTimeout(() => setPwdMsg({ text: '', ok: true }), 4000);
  };

  const getGpaColor = (gpa) => {
    if (gpa >= 3.4) return '#10b981';
    if (gpa >= 3.0) return '#3b82f6';
    if (gpa >= 2.0) return '#f59e0b';
    if (gpa >= 1.0) return '#e67e22';
    return '#ef4444';
  };

  const getGpaLabel = (gpa) => {
    if (gpa >= 3.4) return 'Good Standing';
    if (gpa >= 3.0) return 'Satisfactory';
    if (gpa >= 2.0) return 'Pass';
    if (gpa >= 1.0) return 'Below Average';
    return 'Probation';
  };

  const getSemesterLabel = (year) => {
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year' };
    return labels[year] || `Year ${year}`;
  };

  if (loading) return <div className="loading">{t('profile.saving')}…</div>;
  if (fetchError) return <div className="loading">⚠️ {fetchError}</div>;
  if (!profile) return <div className="loading">{t('common.noData')}</div>;

  const pfpSrc = profile.profilePicture
    ? (profile.profilePicture.startsWith('data:')
        ? profile.profilePicture
        : `${API_URL}/${profile.profilePicture}`)
    : null;

  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-card">

        {/* Avatar */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-wrapper" onClick={() => fileRef.current.click()} title="Click to change photo">
            {pfpSrc ? (
              <img src={pfpSrc} alt="Profile" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-initials">{initials}</div>
            )}
            <div className="profile-avatar-overlay"><span>📷</span></div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePictureUpload} />
          {uploading && <p className="upload-status uploading">Uploading...</p>}
          {uploadMsg && !uploading && (
            <p className={`upload-status ${uploadMsg.includes('Failed') ? 'error' : 'success'}`}>{uploadMsg}</p>
          )}
          <p className="avatar-hint">Click photo to update</p>
        </div>

        {/* Name & Role */}
        <div className="profile-name-section">
          <h1>{profile.firstName} {profile.lastName}</h1>
          <span className="profile-role-badge">{profile.role === 'admin' ? '👨‍💼 Admin' : '🎓 Student'}</span>
        </div>

        {/* Info Grid */}
        <div className="profile-info-grid">
          <div className="profile-info-item">
            <span className="profile-info-icon">🪪</span>
            <div>
              <p className="profile-info-label">{t('profile.studentId')}</p>
              <p className="profile-info-value">{profile.studentId}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">✉️</span>
            <div>
              <p className="profile-info-label">{t('profile.email')}</p>
              <p className="profile-info-value">{profile.email}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">📚</span>
            <div>
              <p className="profile-info-label">{t('profile.major')}</p>
              <p className="profile-info-value">{profile.major}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">📅</span>
            <div>
              <p className="profile-info-label">{t('profile.year')}</p>
              <p className="profile-info-value">{getSemesterLabel(profile.year)}</p>
            </div>
          </div>
          {profile.lectureGroup && (
            <div className="profile-info-item">
              <span className="profile-info-icon">👥</span>
              <div>
                <p className="profile-info-label">{t('profile.group')}</p>
                <p className="profile-info-value">Group {profile.lectureGroup}</p>
              </div>
            </div>
          )}
          {profile.section && (
            <div className="profile-info-item">
              <span className="profile-info-icon">🔬</span>
              <div>
                <p className="profile-info-label">Section</p>
                <p className="profile-info-value">Section {profile.section}</p>
              </div>
            </div>
          )}
          <div className="profile-info-item">
            <span className="profile-info-icon">📖</span>
            <div>
              <p className="profile-info-label">{t('dashboard.enrolledCourses')}</p>
              <p className="profile-info-value">{profile.enrolledCourses?.length || 0} {t('common.courses')}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">✅</span>
            <div>
              <p className="profile-info-label">{t('dashboard.completedCourses')}</p>
              <p className="profile-info-value">{grades.length} {t('common.courses')}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">🎓</span>
            <div>
              <p className="profile-info-label">{t('dashboard.totalCredits')}</p>
              <p className="profile-info-value">{gpaData.totalCredits} {t('common.credits')}</p>
            </div>
          </div>
          <div className="profile-info-item">
            <span className="profile-info-icon">⭐</span>
            <div>
              <p className="profile-info-label">{t('profile.role') === 'Role' ? 'CGPA' : t('dashboard.cgpa')}</p>
              <p className="profile-info-value" style={{ color: getGpaColor(gpaData.gpa) }}>{gpaData.gpa.toFixed(2)} / 4.0</p>
            </div>
          </div>
        </div>

        {/* GPA Display */}
        <div className="profile-gpa-section">
          <div className="profile-gpa-circle" style={{ '--gpa-color': getGpaColor(gpaData.gpa) }}>
            <span className="profile-gpa-value">{gpaData.gpa.toFixed(2)}</span>
            <span className="profile-gpa-label">CGPA</span>
          </div>
          <div className="profile-gpa-info">
            <p className="profile-gpa-status" style={{ color: getGpaColor(gpaData.gpa) }}>
              {getGpaLabel(gpaData.gpa)}
            </p>
            <p className="profile-gpa-scale">Out of 4.0</p>
            <p className="profile-gpa-courses">{grades.length} courses completed</p>
          </div>
        </div>

        {/* Completed Courses */}
        {grades.length > 0 && (
          <div className="profile-completed-section">
            <h3 className="profile-section-title">✅ {t('studentProfile.grades')}</h3>
            <div className="profile-completed-list">
              {grades.map((g) => (
                <div key={g._id} className="profile-completed-item">
                  <div className="profile-completed-info">
                    <span className="profile-completed-code">{g.course?.courseCode}</span>
                    <span className="profile-completed-name">{g.course?.courseName}</span>
                    <span className="profile-completed-meta">{g.semester} {g.year} · {g.course?.credits} cr</span>
                  </div>
                  <span className={`grade-badge ${gradeClass(g.grade)}`}>{g.grade}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Enrolled Courses */}
        {profile.enrolledCourses?.length > 0 && (
          <div className="profile-completed-section">
            <h3 className="profile-section-title">📖 {t('studentProfile.enrolledCourses')}</h3>
            <div className="profile-completed-list">
              {profile.enrolledCourses.map((c) => (
                <div key={c._id} className="profile-completed-item">
                  <div className="profile-completed-info">
                    <span className="profile-completed-code">{c.courseCode}</span>
                    <span className="profile-completed-name">{c.courseName}</span>
                    <span className="profile-completed-meta">{c.semester} · {c.credits} cr</span>
                  </div>
                  <span className="profile-active-badge">IN PROGRESS</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Change Password */}
        <div className="profile-pwd-section">
          <h3 className="profile-section-title">🔑 {t('profile.changePassword')}</h3>
          <form className="profile-pwd-form" onSubmit={handleChangePassword}>
            <input type="password" placeholder={t('profile.currentPassword')} value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} required />
            <input type="password" placeholder={t('profile.newPassword')} value={pwdForm.next} onChange={e => setPwdForm({...pwdForm, next: e.target.value})} required />
            <input type="password" placeholder={t('profile.confirmPassword')} value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} required />
            {pwdMsg.text && <p className={`pwd-msg ${pwdMsg.ok ? 'pwd-msg--ok' : 'pwd-msg--err'}`}>{pwdMsg.text}</p>}
            <button type="submit" className="btn-change-pwd" disabled={pwdSaving}>
              {pwdSaving ? t('profile.saving') : `🔑 ${t('profile.changePassword')}`}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;

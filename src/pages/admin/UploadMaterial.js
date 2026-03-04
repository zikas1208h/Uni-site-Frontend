import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseAPI, materialAPI, authAPI } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './UploadMaterial.css';

const UploadMaterial = () => {
  const navigate = useNavigate();
  const { user, login: _login, loadUser } = useAuth();
  const { t } = useLanguage();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    course: '',
    title: '',
    description: '',
    type: 'lecture',
  });

  useEffect(() => {
    // Always fetch fresh user to get latest effective assignedCourses for assistants
    authAPI.getMe().then(r => {
      const freshUser = r.data;
      const all_courses_promise = courseAPI.getAllCourses();
      all_courses_promise.then(res => {
        const all = res.data || [];
        if (freshUser.role === 'superadmin' || freshUser.role === 'admin') {
          setCourses(all);
        } else {
          const assignedIds = new Set((freshUser.assignedCourses || []).map(c => (c._id || c).toString()));
          setCourses(assignedIds.size > 0 ? all.filter(c => assignedIds.has(c._id?.toString())) : []);
        }
      }).catch(() => setError('Failed to load courses'));
    }).catch(() => {
      // fallback to context user
      courseAPI.getAllCourses().then(res => {
        const all = res.data || [];
        if (isSuperAdmin(user)) { setCourses(all); return; }
        const assignedIds = new Set((user?.assignedCourses || []).map(c => (c._id || c).toString()));
        setCourses(assignedIds.size > 0 ? all.filter(c => assignedIds.has(c._id?.toString())) : []);
      }).catch(() => setError('Failed to load courses'));
    });
  }, []); // eslint-disable-line

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleFileChange = (e) => setFile(e.target.files[0] || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!file)           return setError('Please select a file to upload');
    if (!formData.course) return setError('Please select a course');

    setLoading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('course', formData.course);
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('type', formData.type);
      // uploadedBy is the logged-in user's ID — backend uses req.userId as fallback
      data.append('uploadedBy', user?._id || user?.id || '');

      await materialAPI.uploadMaterial(data);
      setSuccess('✅ Material uploaded successfully! Students have been notified.');
      setFile(null);
      setFormData({ course: '', title: '', description: '', type: 'lecture' });
      const fileInput = document.getElementById('file');
      if (fileInput) fileInput.value = '';
      // Navigate immediately — ViewMaterials will remount and fetch fresh data
      navigate('/admin/view-materials');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload material');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-material">
      <div className="upload-material-header">
        <h1>📤 {t('uploadMaterial.title')}</h1>
        <p>Add new study materials for your courses — students will be notified automatically</p>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-section">
          <h2>📚 {t('uploadMaterial.title')}</h2>

          <div className="form-group">
            <label htmlFor="course">{t('uploadMaterial.course')} *</label>
            <select id="course" name="course" value={formData.course} onChange={handleChange} required>
              <option value="">{t('uploadMaterial.selectCourse')}</option>
              {courses.map(course => (
                <option key={course._id} value={course._id}>
                  {course.courseCode} — {course.courseName}
                </option>
              ))}
            </select>
            {courses.length === 0 && !isSuperAdmin(user) && (
              <p style={{ color: '#f59e0b', fontSize: 13, marginTop: 6 }}>
                ⚠️ No courses assigned to you. Contact admin.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="title">{t('uploadMaterial.titleField')} *</label>
            <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g., Week 1 Lecture Notes" />
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('uploadMaterial.description')} *</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} required rows="4" placeholder="Describe the material content..." />
          </div>

          <div className="form-group">
            <label htmlFor="type">{t('uploadMaterial.type')} *</label>
            <select id="type" name="type" value={formData.type} onChange={handleChange} required>
              <option value="lecture">📚 Lecture</option>
              <option value="assignment">📝 {t('assignments.assignment')}</option>
              <option value="reading">📖 Reading</option>
              <option value="video">🎥 Video</option>
              <option value="other">📄 {t('uploadMaterial.other')}</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h2>📎 File Upload</h2>
          <div className="file-upload-area">
            <input type="file" id="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.mp4,.avi,.mov" />
            <label htmlFor="file" className="file-upload-label">
              <div className="upload-icon">📁</div>
              <div className="upload-text">
                {file ? (
                  <><strong>{file.name}</strong><p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p></>
                ) : (
                  <><strong>{t('uploadMaterial.chooseFile')}</strong><p>or drag and drop here</p><p className="file-types">PDF, DOC, PPT, Video, ZIP (Max 50MB)</p></>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/admin/view-materials')} className="btn-secondary">{t('common.cancel')}</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t('uploadMaterial.uploading') : `📤 ${t('uploadMaterial.upload')}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UploadMaterial;


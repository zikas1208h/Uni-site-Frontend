import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseAPI } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './CreateCourse.css';

const CreateCourse = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Guard: only superadmins may create courses
  useEffect(() => {
    if (user && !isSuperAdmin(user)) {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    description: '',
    credits: 3,
    instructor: '',
    semester: 'Fall',
    year: 2026,
    scheduleDays: [],
    scheduleTime: '',
    hasPractical: false,
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleDaysChange = (day) => {
    const days = [...formData.scheduleDays];
    const index = days.indexOf(day);

    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(day);
    }

    setFormData({ ...formData, scheduleDays: days });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const courseData = {
        courseCode: formData.courseCode,
        courseName: formData.courseName,
        description: formData.description,
        credits: parseInt(formData.credits),
        instructor: formData.instructor,
        semester: formData.semester,
        year: parseInt(formData.year),
        hasPractical: formData.hasPractical,
        schedule: {
          days: formData.scheduleDays,
          time: formData.scheduleTime
        }
      };

      await courseAPI.createCourse(courseData);
      setSuccess('Course created successfully!');

      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-course">
      <div className="create-course-header">
        <h1>➕ Create New Course</h1>
        <p>Add a new course to the university system</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="course-form">
        <div className="form-section">
          <h2>📚 Course Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="courseCode">Course Code *</label>
              <input
                type="text"
                id="courseCode"
                name="courseCode"
                value={formData.courseCode}
                onChange={handleChange}
                required
                placeholder="e.g., CS101"
              />
            </div>

            <div className="form-group">
              <label htmlFor="courseName">Course Name *</label>
              <input
                type="text"
                id="courseName"
                name="courseName"
                value={formData.courseName}
                onChange={handleChange}
                required
                placeholder="e.g., Introduction to Programming"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              placeholder="Enter course description..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="credits">Credits *</label>
              <input
                type="number"
                id="credits"
                name="credits"
                value={formData.credits}
                onChange={handleChange}
                required
                min="1"
                max="6"
              />
            </div>

            <div className="form-group">
              <label htmlFor="instructor">Instructor *</label>
              <input
                type="text"
                id="instructor"
                name="instructor"
                value={formData.instructor}
                onChange={handleChange}
                required
                placeholder="e.g., Dr. John Smith"
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input
                type="checkbox"
                checked={formData.hasPractical}
                onChange={e => setFormData({ ...formData, hasPractical: e.target.checked })}
                style={{ width:18, height:18, cursor:'pointer' }}
              />
              <span>🔬 This course has a <strong>Practical Exam</strong> component</span>
            </label>
            <small style={{ color:'#64748b', marginTop:4, display:'block', paddingLeft:28 }}>
              When enabled, a "Practical Exam" slot will appear in the classwork grades for this course.
            </small>
          </div>
        </div>

        <div className="form-section">
          <h2>📅 Schedule Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="semester">Semester *</label>
              <select
                id="semester"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
              >
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
                min="2024"
                max="2030"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Days of Week *</label>
            <div className="days-selector">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <label key={day} className="day-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.scheduleDays.includes(day)}
                    onChange={() => handleDaysChange(day)}
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="scheduleTime">Time *</label>
            <input
              type="text"
              id="scheduleTime"
              name="scheduleTime"
              value={formData.scheduleTime}
              onChange={handleChange}
              required
              placeholder="e.g., 10:00 AM - 11:30 AM"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCourse;


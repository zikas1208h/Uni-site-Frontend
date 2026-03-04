import React, { useState, useEffect, useCallback } from 'react';
import { courseAPI, gradeAPI, pageCache } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Courses.css';

const Courses = () => {
  const [allCourses, setAllCourses]           = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [passedCourseNames, setPassedCourseNames] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [enrolling, setEnrolling] = useState(null);
  const { user } = useAuth();
  const { t } = useLanguage();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' ||
                  user?.role === 'doctor' || user?.role === 'assistant';

  const fetchCourses = useCallback(async () => {
    await pageCache(`courses:${user?._id}:${isAdmin}`, async () => {
      const [allRes, enrolledRes, gradesRes] = await Promise.all([
        courseAPI.getAllCourses().catch(() => ({ data: [] })),
        courseAPI.getEnrolledCourses().catch(() => ({ data: [] })),
        gradeAPI.getStudentGrades().catch(() => ({ data: [] })),
      ]);
      let courses = allRes.data || [];
      if (!isAdmin && user?.major) {
        courses = courses.filter(course => {
          const isShared = !course.major || course.major === 'Shared' || course.major === 'shared';
          return (isShared || course.major === user.major) && course.status !== 'completed';
        });
      }
      return {
        courses,
        enrolled: enrolledRes.data || [],
        passed: (gradesRes.data || []).filter(g => g.gradePoint >= 1.0).map(g => (g.course?.courseName || '').toLowerCase().trim()),
      };
    }, (data) => {
      setAllCourses(data.courses);
      setEnrolledCourses(data.enrolled);
      setPassedCourseNames(data.passed);
      setLoading(false);
    });
  }, [isAdmin, user?._id, user?.major]); // eslint-disable-line

  useEffect(() => { fetchCourses(); }, [fetchCourses]);


  const getUnmetPrereqs = useCallback((course) => {
    if (!course.prerequisites || course.prerequisites.length === 0) return [];
    return course.prerequisites.filter(p => {
      const lower = p.toLowerCase().trim();
      if (lower.includes('level') || lower.includes('credit') || lower.includes('completed')) return false;
      return !passedCourseNames.includes(lower);
    });
  }, [passedCourseNames]);

  const handleEnroll = async (courseId) => {
    setEnrolling(courseId);
    try {
      const response = await courseAPI.enrollInCourse(courseId);
      if (response.data.creditStatus) {
        const { creditStatus, courseDetails } = response.data;
        alert(
          `Successfully enrolled in ${courseDetails.courseName}!\n\n` +
          `📚 Course Credits: ${courseDetails.credits}\n` +
          `📊 Your CGPA: ${creditStatus.cgpa.toFixed(2)}\n` +
          `⚡ Credit Limit: ${creditStatus.creditLimit} hours\n` +
          `✅ Current Enrolled: ${creditStatus.currentCredits} hours\n` +
          `📈 Remaining: ${creditStatus.remaining} hours`
        );
      } else {
        alert('Successfully enrolled in course!');
      }
      fetchCourses();
    } catch (error) {
      console.error('Error enrolling:', error);
      if (error.response?.data?.unmetPrerequisites) {
        alert(`❌ Prerequisites not met!\n\nYou must first pass:\n` +
          error.response.data.unmetPrerequisites.map(p => `  • ${p}`).join('\n'));
      } else if (error.response?.data?.details) {
        const d = error.response.data.details;
        alert(`❌ ${error.response.data.message}\n\n` +
          `📊 Your CGPA: ${d.cgpa.toFixed(2)}\n` +
          `⚡ Credit Limit: ${d.creditLimit} hours\n` +
          `📚 Currently Enrolled: ${d.currentCredits} hours\n` +
          `❗ This Course: ${d.courseCredits} hours\n` +
          `📈 Available: ${d.available} hours`);
      } else {
        alert(error.response?.data?.message || 'Failed to enroll');
      }
    } finally {
      setEnrolling(null);
    }
  };

  const isEnrolled = useCallback((courseId) =>
    enrolledCourses.some(course => course._id === courseId), [enrolledCourses]);

  if (loading) return <div className="loading">{t('courses.loading')}</div>;

  return (
    <div className="courses-page">
      <h1>{t('courses.availableCourses')}</h1>
      <div className="courses-list">
        {allCourses.filter(course => isAdmin || !isEnrolled(course._id)).map((course) => {
          const enrolled = isEnrolled(course._id);
          const unmet    = isAdmin ? [] : getUnmetPrereqs(course);
          const blocked  = unmet.length > 0;
          return (
            <div key={course._id} className={`course-item ${enrolled ? 'enrolled' : ''} ${blocked ? 'prereq-blocked' : ''}`}>
              <div className="course-header">
                <div>
                  <h3>{course.courseName}</h3>
                  <p className="course-code">{course.courseCode}</p>
                </div>
                <div className="course-credits-badge">{course.credits} {t('courses.credits')}</div>
              </div>
              <p className="course-description">{course.description}</p>
              <div className="course-details">
                <div className="detail-item"><strong>{t('courses.semester')}:</strong> {course.semester} {course.year}</div>
                <div className="detail-item"><strong>{t('courses.major')}:</strong> {course.major || t('courses.shared')}</div>
              </div>
              {course.prerequisites && course.prerequisites.length > 0 && (
                <div className="course-prerequisites">
                  <strong>{t('courses.prerequisites')}:</strong>
                  <div className="prereq-tags">
                    {course.prerequisites.map((p, i) => {
                      const met = passedCourseNames.includes(p.toLowerCase().trim()) ||
                        p.toLowerCase().includes('level') || p.toLowerCase().includes('credit') ||
                        p.toLowerCase().includes('completed');
                      return (
                        <span key={i} className={`prereq-tag ${isAdmin ? '' : met ? 'prereq-met' : 'prereq-unmet'}`}>
                          {!isAdmin && (met ? '✓ ' : '✗ ')}{p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {blocked && <div className="prereq-warning">🔒 {t('courses.prereqNotMet')}</div>}
              <div className="course-actions">
                {isAdmin ? (
                  <button className="btn-admin-info" disabled>👨‍💼 Admin View Only</button>
                ) : enrolled ? (
                  <button className="btn-enrolled" disabled>✓ {t('courses.enrolled')}</button>
                ) : blocked ? (
                  <button className="btn-blocked" disabled>🔒 {t('courses.prerequisites')}</button>
                ) : (
                  <button className="btn-enroll" onClick={() => handleEnroll(course._id)} disabled={enrolling === course._id}>
                    {enrolling === course._id ? t('courses.enrolling') : t('courses.enroll')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Courses;

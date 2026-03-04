import React, { useState, useEffect, useCallback } from 'react';
import { materialAPI, courseAPI, pageCache } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import './Materials.css';

const Materials = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchMaterials = useCallback(async () => {
    try {
      await pageCache(`materials:${user?._id}`, async () => {
        const [materialsRes, coursesRes] = await Promise.all([
          materialAPI.getMyMaterials(),
          courseAPI.getEnrolledCourses(),
        ]);
        return { materials: materialsRes.data || [], courses: coursesRes.data || [] };
      }, (data) => {
        setMaterials(data.materials);
        setEnrolledCourses(data.courses);
        if (data.courses.length > 0) setSelectedCourse(c => c || data.courses[0]._id);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error fetching materials:', error);
      setLoading(false);
    }
  }, [user?._id]); // eslint-disable-line

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);


  const getMaterialsForCourse = (courseId) =>
    materials.filter(m => m.course && m.course._id === courseId);

  const getFilteredMaterials = (courseId) => {
    const cm = getMaterialsForCourse(courseId);
    if (activeTab === 'all') return cm;
    return cm.filter(m => m.type === activeTab);
  };

  const getTabCount = (courseId, type) => {
    const cm = getMaterialsForCourse(courseId);
    if (type === 'all') return cm.length;
    return cm.filter(m => m.type === type).length;
  };

  const TYPE_ICON = { lecture: '📚', assignment: '📝', reading: '📖', video: '🎥', other: '📄' };
  const getIcon = (type) => TYPE_ICON[type] || '📄';

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = (material) => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    // Use the download API endpoint with auth token in URL
    window.open(`${API_URL}/api/materials/download/${material._id}?token=${token}`, '_blank');
  };

  if (loading) return <div className="mat-loading">{t('materials.loading')}</div>;

  if (enrolledCourses.length === 0) {
    return (
      <div className="mat-page">
        <div className="mat-header"><h1>{t('materials.title')}</h1></div>
        <div className="mat-empty">
          <span className="mat-empty-icon">📚</span>
          <h3>{t('courses.noCoursesFound')}</h3>
          <p>{t('dashboard.noCoursesEnrolled')}</p>
        </div>
      </div>
    );
  }

  const currentCourse = enrolledCourses.find(c => c._id === selectedCourse);
  const displayMaterials = selectedCourse ? getFilteredMaterials(selectedCourse) : [];

  const TABS = [
    { key: 'all',        label: t('courses.allStatus') === 'All Status' ? 'All' : t('courses.allStatus') },
    { key: 'lecture',    label: 'Lectures' },
    { key: 'assignment', label: t('assignments.assignment') },
    { key: 'video',      label: 'Videos' },
    { key: 'reading',    label: 'Readings' },
    { key: 'other',      label: 'Resources' },
  ];

  return (
    <div className="mat-page">
      <div className="mat-header">
        <h1>{t('materials.title')}</h1>
        <p>Access all your study resources</p>
      </div>

      <div className="mat-courses">
        <h3>{t('courses.availableCourses')}</h3>
        <div className="mat-course-grid">
          {enrolledCourses.map(course => (
            <button key={course._id} className={`mat-course-btn${selectedCourse === course._id ? ' active' : ''}`} onClick={() => { setSelectedCourse(course._id); setActiveTab('all'); }}>
              <span className="mat-c-code">{course.courseCode}</span>
              <span className="mat-c-name">{course.courseName}</span>
              <span className="mat-c-count">{getMaterialsForCourse(course._id).length} files</span>
            </button>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <div className="mat-content">
          <div className="mat-banner">
            <div className="mat-banner-title">{currentCourse?.courseName}</div>
            <div className="mat-banner-sub">{currentCourse?.courseCode}</div>
          </div>

          <div className="mat-tabs">
            {TABS.map(tab => (
              <button key={tab.key} className={`mat-tab${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label} <span className="mat-tab-count">({getTabCount(selectedCourse, tab.key)})</span>
              </button>
            ))}
          </div>

          {displayMaterials.length === 0 ? (
            <div className="mat-no-items"><span>{t('materials.noMaterials')}</span></div>
          ) : (
            <div className="mat-list">
              {displayMaterials.map((material, i) => (
                <div key={material._id} className="mat-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="mat-item-icon">{getIcon(material.type)}</div>
                  <div className="mat-item-body">
                    <div className="mat-item-title">{material.title}</div>
                    {material.description && <div className="mat-item-desc">{material.description}</div>}
                    <div className="mat-item-tags">
                      <span className="mat-tag mat-tag-type">{material.type}</span>
                      {formatSize(material.fileSize) && <span className="mat-tag mat-tag-size">{formatSize(material.fileSize)}</span>}
                      <span className="mat-tag mat-tag-date">{new Date(material.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mat-item-footer">
                      <span className="mat-uploader">{t('materials.uploadedBy')}: {material.uploadedBy}</span>
                      <button className="mat-dl-btn" onClick={() => handleDownload(material)}>{t('materials.download')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Materials;

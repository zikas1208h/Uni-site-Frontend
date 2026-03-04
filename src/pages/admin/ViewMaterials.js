import React, { useState, useEffect, useCallback } from 'react';
import { materialAPI, courseAPI, pageCache } from '../../services/api';
import { useAuth, isAnyAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './ViewMaterials.css';

const TYPE_ICONS   = { Lecture:'📖', Section:'📝', Video:'🎥', Extra:'📚', lecture:'📖', assignment:'📋', reading:'📄', video:'🎥', other:'📁' };
const TYPE_COLORS  = { Lecture:'#667eea', Section:'#f6ad55', Video:'#fc8181', Extra:'#68d391', lecture:'#667eea', assignment:'#f6ad55', reading:'#68d391', video:'#fc8181', other:'#a0aec0' };
const DISPLAY_TYPES = ['Lecture','Section','Video','Extra'];

const normalizeType = (type) => {
  if (!type) return 'Other';
  const map = { lecture:'Lecture', section:'Section', video:'Video', extra:'Extra', assignment:'Section', reading:'Lecture', other:'Extra' };
  return map[type.toLowerCase()] || type;
};

const ViewMaterials = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = isAnyAdmin(user);

  const [materials, setMaterials]           = useState([]);
  const [courses, setCourses]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [filter, setFilter]                 = useState({ course: '', type: '', search: '' });
  const [expandedCourses, setExpandedCourses] = useState({});

  // ── fetchData defined FIRST before any useEffect that references it ──────
  const fetchData = useCallback(async () => {
    setError('');
    try {
      await pageCache(`viewmaterials:${user?._id}:${isAdmin}`, async () => {
        let materialsRes, coursesRes;
        if (isAdmin) {
          [materialsRes, coursesRes] = await Promise.all([
            materialAPI.getAllMaterials(),
            courseAPI.getAllCourses(),
          ]);
        } else {
          [materialsRes, coursesRes] = await Promise.all([
            materialAPI.getMyMaterials(),
            courseAPI.getEnrolledCourses(),
          ]);
        }
        return {
          mats: Array.isArray(materialsRes.data) ? materialsRes.data : [],
          courses: Array.isArray(coursesRes.data) ? coursesRes.data : [],
        };
      }, (data) => {
        setMaterials(data.mats);
        setCourses(data.courses);
        const expanded = {};
        data.mats.forEach(m => { if (m.course?._id) expanded[m.course._id] = true; });
        setExpandedCourses(expanded);
        setLoading(false);
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to load materials: ${err.response?.data?.message || err.message}`);
      setLoading(false);
    }
  }, [isAdmin, user?._id]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);


  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await materialAPI.deleteMaterial(id);
      setMaterials(prev => prev.filter(m => m._id !== id));
    } catch (err) { alert('Error deleting material'); }
  };

  const toggleCourse = (courseId) =>
    setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));

  const filteredMaterials = materials.filter(m => {
    const matchesCourse = !filter.course || m.course?._id === filter.course;
    const matchesType   = !filter.type   || normalizeType(m.type) === filter.type;
    const matchesSearch = !filter.search ||
      m.title?.toLowerCase().includes(filter.search.toLowerCase()) ||
      m.course?.courseName?.toLowerCase().includes(filter.search.toLowerCase());
    return matchesCourse && matchesType && matchesSearch;
  });

  const groupedMaterials = filteredMaterials.reduce((acc, m) => {
    const key = m.course?._id || 'uncategorized';
    if (!acc[key]) acc[key] = { course: m.course, materials: [] };
    acc[key].materials.push(m);
    return acc;
  }, {});

  if (loading) return (
    <div className="vm-loading"><div className="vm-spinner"></div><p>{t('common.loading')}</p></div>
  );

  return (
    <div className="view-materials">
      <div className="vm-header">
        <div>
          <h1>📁 {t('viewMaterials.title')}</h1>
          <p>{isAdmin ? 'Review and manage all uploaded materials' : 'Access materials from your enrolled courses'}</p>
        </div>
        <div className="vm-header-stats">
          <div className="vm-stat"><span>{materials.length}</span><small>Total Files</small></div>
          <div className="vm-stat"><span>{Object.keys(groupedMaterials).length}</span><small>{t('common.courses')}</small></div>
        </div>
      </div>

      {error && (
        <div className="vm-error">❌ {error}
          <button onClick={fetchData} className="vm-retry-btn">{t('gradeStats.retry')}</button>
        </div>
      )}

      <div className="vm-filters">
        <input type="text" placeholder={`🔍 ${t('viewMaterials.searchPlaceholder')}`}
          value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} className="vm-search" />
        <select value={filter.course} onChange={e => setFilter(f => ({ ...f, course: e.target.value }))}>
          <option value="">{t('viewMaterials.allCourses')}</option>
          {courses.map(course => (
            <option key={course._id} value={course._id}>{course.courseCode} - {course.courseName}</option>
          ))}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">{t('viewMaterials.allTypes')}</option>
          <option value="Lecture">📖 Lecture</option>
          <option value="Section">📝 Section</option>
          <option value="Video">🎥 Video</option>
          <option value="Extra">📚 Extra Resources</option>
        </select>
        {(filter.course || filter.type || filter.search) && (
          <button className="vm-clear-btn" onClick={() => setFilter({ course:'', type:'', search:'' })}>✕ Clear</button>
        )}
      </div>

      {Object.keys(groupedMaterials).length === 0 ? (
        <div className="vm-empty">
          <div className="vm-empty-icon">📭</div>
          <h3>{t('viewMaterials.noMaterials')}</h3>
        </div>
      ) : (
        <div className="vm-groups">
          {Object.values(groupedMaterials).map(({ course: grpCourse, materials: courseMaterials }) => (
            <div key={grpCourse?._id || 'uncategorized'} className="vm-course-group">
              <div className="vm-course-header" onClick={() => toggleCourse(grpCourse?._id || 'uncategorized')}>
                <div className="vm-course-title">
                  <span className="vm-course-code">{grpCourse?.courseCode || 'N/A'}</span>
                  <span className="vm-course-name">{grpCourse?.courseName || 'Uncategorized'}</span>
                </div>
                <div className="vm-course-meta">
                  <span className="vm-count-badge">{courseMaterials.length} file{courseMaterials.length !== 1 ? 's' : ''}</span>
                  <span className="vm-chevron">{expandedCourses[grpCourse?._id || 'uncategorized'] ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedCourses[grpCourse?._id || 'uncategorized'] && (
                <div className="vm-materials-list">
                  {DISPLAY_TYPES.map(dtype => {
                    const typeItems = courseMaterials.filter(m => normalizeType(m.type) === dtype);
                    if (typeItems.length === 0) return null;
                    return (
                      <div key={dtype} className="vm-type-group">
                        <div className="vm-type-label" style={{ color: TYPE_COLORS[dtype] }}>
                          {TYPE_ICONS[dtype]} {dtype === 'Extra' ? 'Extra Resources' : dtype}
                          <span className="vm-type-count">({typeItems.length})</span>
                        </div>
                        {typeItems.map(material => (
                          <div key={material._id} className="vm-material-card">
                            <div className="vm-material-icon" style={{ background: TYPE_COLORS[normalizeType(material.type)] + '20', color: TYPE_COLORS[normalizeType(material.type)] }}>
                              {TYPE_ICONS[normalizeType(material.type)] || '📄'}
                            </div>
                            <div className="vm-material-info">
                              <div className="vm-material-title">{material.title}</div>
                              {material.description && <div className="vm-material-desc">{material.description}</div>}
                              <div className="vm-material-meta">
                                <span>{material.fileSize ? `${(material.fileSize/(1024*1024)).toFixed(2)} MB` : 'N/A'}</span>
                                <span>·</span>
                                <span>{new Date(material.createdAt).toLocaleDateString()}</span>
                                {material.uploadedBy && (
                                  <><span>·</span>
                                  <span>{t('viewMaterials.uploadedBy')} {typeof material.uploadedBy === 'object' ? `${material.uploadedBy?.firstName||''} ${material.uploadedBy?.lastName||''}`.trim() : material.uploadedBy}</span></>
                                )}
                              </div>
                            </div>
                            <div className="vm-material-actions">
                              <a href={`${process.env.REACT_APP_API_URL||'http://localhost:5000'}/api/materials/download/${material._id}?token=${localStorage.getItem('token')}`}
                                target="_blank" rel="noopener noreferrer" className="vm-btn-download">
                                📥 {t('viewMaterials.download')}
                              </a>
                              {isAdmin && (
                                <button onClick={() => handleDelete(material._id)} className="vm-btn-delete">🗑️</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewMaterials;


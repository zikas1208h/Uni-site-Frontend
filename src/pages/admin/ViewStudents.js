import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, courseAPI, pageCache } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './ViewStudents.css';

const ViewStudents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMajor, setFilterMajor] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [courseOptions, setCourseOptions] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        await pageCache(`viewstudents:${user?._id}`, async () => {
          const [studRes, courseRes] = await Promise.all([
            studentAPI.getAllStudents(),
            isSuperAdmin(user)
              ? courseAPI.getAllCourses()
              : Promise.resolve({ data: (user?.assignedCourses || []).map(c => typeof c === 'object' ? c : { _id: c, courseCode: '', courseName: '' }) }),
          ]);
          return { students: studRes.data || [], courses: courseRes.data || [] };
        }, (data) => {
          setStudents(data.students);
          setFilteredStudents(data.students);
          setCourseOptions(data.courses);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error fetching students:', error);
        setError(error.response?.data?.message || error.message || 'Failed to load students');
        setLoading(false);
      }
    };
    load();
  }, [user?._id]); // eslint-disable-line

  useEffect(() => {
    filterStudentsData();
  }, [searchTerm, filterMajor, filterYear, filterGroup, filterCourse, students]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterStudentsData = () => {
    let filtered = [...students];

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterMajor !== 'all') {
      filtered = filtered.filter(student => student.major === filterMajor);
    }

    if (filterYear !== 'all') {
      filtered = filtered.filter(student => student.year === parseInt(filterYear));
    }

    if (filterGroup !== 'all') {
      const [g, s] = filterGroup.split('-');
      filtered = filtered.filter(student =>
        student.lectureGroup === parseInt(g) && student.section === parseInt(s)
      );
    }

    // Course/subject filter — student must be enrolled in the selected course
    if (filterCourse !== 'all') {
      filtered = filtered.filter(student =>
        (student.enrolledCourses || []).some(c =>
          (c._id || c).toString() === filterCourse
        )
      );
    }

    setFilteredStudents(filtered);
  };

  const getMajors = () => ['Data Science', 'Multimedia', 'Robotics & AI'];

  if (loading) return <div className="loading">{t('viewStudents.loading')}</div>;

  if (error) {
    return (
      <div className="view-students">
        <div className="view-students-header"><h1>👨‍🎓 {t('viewStudents.title')}</h1></div>
        <div style={{ padding:'40px', textAlign:'center', color:'#ef4444' }}>
          <p style={{ fontSize:18, fontWeight:700 }}>⚠️ {t('gradeStats.failedLoad')}</p>
          <p style={{ color:'#64748b', marginTop:8 }}>{error}</p>
          <button onClick={fetchStudents} style={{ marginTop:16, padding:'10px 24px', background:'#374151', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>🔄 {t('gradeStats.retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-students">
      <div className="view-students-header">
        <h1>👨‍🎓 {t('viewStudents.title')}</h1>
        <p>Total: {filteredStudents.length} {t('common.student').toLowerCase()}{filteredStudents.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input type="text" placeholder={`🔍 ${t('viewStudents.searchPlaceholder')}`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="filters">
          <select value={filterMajor} onChange={(e) => setFilterMajor(e.target.value)}>
            <option value="all">{t('viewStudents.allMajors')}</option>
            {getMajors().map(major => <option key={major} value={major}>{major}</option>)}
          </select>
          {courseOptions.length > 0 && (
            <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
              <option value="all">{t('viewStudents.filterBySubject')}</option>
              {courseOptions.map(c => (
                <option key={(c._id || c).toString()} value={(c._id || c).toString()}>
                  {c.courseCode ? `${c.courseCode} — ${c.courseName}` : c.courseName || c.toString()}
                </option>
              ))}
            </select>
          )}
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="all">All Groups</option>
            {[1,2,3,4,5,6].map(g => [1,2].map(s => (
              <option key={`${g}-${s}`} value={`${g}-${s}`}>Group {g} — Section {s}</option>
            )))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">{t('viewStudents.allYears')}</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">😔</div>
          <h3>{t('viewStudents.noStudents')}</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="students-grid">
          {filteredStudents.map((student, index) => (
            <div key={student._id} className="student-card" style={{ animationDelay:`${index*0.05}s`, cursor:'pointer' }} onClick={() => navigate(`/admin/student/${student._id}`)}>
              <div className="student-avatar">{student.firstName[0]}{student.lastName[0]}</div>
              <div className="student-details">
                <h3>{student.firstName} {student.lastName}</h3>
                <p className="student-id">{student.studentId}</p>
                <p className="student-email">{student.email}</p>
                <div className="student-info">
                  <div className="info-item"><span className="info-label">{t('viewStudents.major')}:</span><span className="info-value">{student.major}</span></div>
                  <div className="info-item"><span className="info-label">{t('viewStudents.year')}:</span><span className="info-value">Year {student.year}</span></div>
                  {student.lectureGroup && (
                    <div className="info-item"><span className="info-label">{t('profile.group')}:</span><span className="info-value">Group {student.lectureGroup} — Section {student.section}</span></div>
                  )}
                  <div className="info-item"><span className="info-label">{t('viewStudents.enrolledCourses')}:</span><span className="info-value">{student.enrolledCourses?.length || 0} {t('common.courses')}</span></div>
                </div>
                <div className="student-badges">
                  <span className="badge badge-major">{student.major}</span>
                  <span className="badge badge-year">Year {student.year}</span>
                  {student.lectureGroup && <span className="badge badge-group">G{student.lectureGroup}-S{student.section}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewStudents;


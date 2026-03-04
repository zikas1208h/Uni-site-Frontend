import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentAPI, gradeAPI, courseAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { exportSchedulePDF, exportScheduleExcel } from '../Schedule';
import './StudentProfile.css';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
const COLORS = ['#667eea','#f6ad55','#68d391','#fc8181','#76e4f7','#b794f4','#f687b3','#4fd1c5','#fbb6ce','#90cdf4'];

// ── GPA helpers ──────────────────────────────────────────────────────────────
const getCgpaColor  = (c) => c >= 3.4 ? '#27ae60' : c >= 3.0 ? '#2980b9' : c >= 2.0 ? '#f39c12' : c >= 1.0 ? '#e67e22' : '#e74c3c';
const getCgpaLabel  = (c) => c >= 3.4 ? 'Good Standing' : c >= 3.0 ? 'Satisfactory' : c >= 2.0 ? 'Pass' : c >= 1.0 ? 'Below Average' : 'Probation';
const gradeFromPoint = (gp) => {
  if (gp >= 4.0) return 'A+'; if (gp >= 3.7) return 'A';  if (gp >= 3.4) return 'A-';
  if (gp >= 3.2) return 'B+'; if (gp >= 3.0) return 'B';  if (gp >= 2.8) return 'B-';
  if (gp >= 2.6) return 'C+'; if (gp >= 2.4) return 'C';  if (gp >= 2.2) return 'C-';
  if (gp >= 2.0) return 'D+'; if (gp >= 1.5) return 'D';  if (gp >= 1.0) return 'D-';
  return 'F';
};

// ── PDF generator ────────────────────────────────────────────────────────────
const generateStudentPDF = async (sections, student, gradesData, adminUser) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const cgpa = gradesData?.cgpa || 0;
  const grades = gradesData?.grades || [];
  let y = 0;

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text('HNU University Portal', W / 2, 11, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Individual Student Report', W / 2, 19, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${now}  |  By: ${adminUser?.firstName} ${adminUser?.lastName} (${adminUser?.role})`, W / 2, 27, { align: 'center' });
  y = 42;

  const sectionBand = (title, rgb) => {
    if (y > 252) { doc.addPage(); y = 15; }
    doc.setFillColor(...rgb);
    doc.roundedRect(14, y, W - 28, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(title, 19, y + 6);
    doc.setTextColor(30, 41, 59);
    y += 13;
  };

  // ── Student info card ──────────────────────────────────────────────────────
  if (sections.info) {
    sectionBand('👤 Student Information', [30, 41, 59]);
    const rgbCgpa = getCgpaColor(cgpa).replace('#','').match(/.{2}/g).map(h=>parseInt(h,16));

    // Left info block
    const lines = [
      ['Full Name',    `${student.firstName} ${student.lastName}`],
      ['Student ID',   student.studentId || '—'],
      ['Email',        student.email || '—'],
      ['Major',        student.major || '—'],
      ['Year',         student.year ? `Year ${student.year}` : '—'],
      ['Group',        student.lectureGroup ? `Group ${student.lectureGroup} — Section ${student.section}` : '—'],
    ];
    const colW = (W - 28) / 2 - 6;
    lines.forEach(([label, value], i) => {
      const lx = 14, ly = y + i * 8;
      if (ly > 265) return;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text(label, lx, ly);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
      doc.text(value, lx + 28, ly);
    });

    // CGPA badge on right
    const bx = W / 2 + 10, by = y;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, by, colW, 44, 4, 4, 'FD');
    doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(...rgbCgpa);
    doc.text(cgpa.toFixed(2), bx + colW / 2, by + 18, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text('CGPA / 4.0', bx + colW / 2, by + 26, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...rgbCgpa);
    doc.text(getCgpaLabel(cgpa), bx + colW / 2, by + 34, { align: 'center' });

    // Stats row
    const enrolled = student.enrolledCourses || [];
    const totalCredits = enrolled.reduce((s, c) => s + (c.credits || 0), 0);
    const stats = [
      { label: 'Enrolled', value: enrolled.length },
      { label: 'Graded',   value: grades.length   },
      { label: 'Credits',  value: totalCredits     },
    ];
    const sw = (colW - 8) / 3;
    stats.forEach((s, i) => {
      const sx = bx + i * (sw + 4), sy = by + 46;
      doc.setFillColor(240, 249, 255); doc.roundedRect(sx, sy, sw, 14, 2, 2, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(String(s.value), sx + sw / 2, sy + 7, { align: 'center' });
      doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(s.label, sx + sw / 2, sy + 12, { align: 'center' });
    });

    y += 70;
  }

  // ── Grades ────────────────────────────────────────────────────────────────
  if (sections.grades && grades.length > 0) {
    sectionBand('📊 Academic Grades', [15, 118, 110]);

    // Group by semester
    const byTerm = grades.reduce((acc, g) => {
      const key = `${g.semester} ${g.year}`;
      (acc[key] = acc[key] || []).push(g);
      return acc;
    }, {});

    for (const [term, termGrades] of Object.entries(byTerm)) {
      if (y > 240) { doc.addPage(); y = 15; }
      const avg = termGrades.reduce((s, g) => s + g.gradePoint, 0) / termGrades.length;
      doc.setFillColor(51, 65, 85); doc.roundedRect(14, y, W - 28, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`${term}   —   Semester GPA: ${avg.toFixed(2)}`, 18, y + 4.8);
      y += 9;

      autoTable(doc, {
        startY: y,
        head: [['Code', 'Course Name', 'Credits', 'Quiz', 'Assignment', 'Final', 'Grade', 'GPA Points']],
        body: termGrades.map(g => [
          g.course?.courseCode || '—',
          (g.course?.courseName || '—') + (g.isRetake ? ' ↩' : ''),
          g.course?.credits || '—',
          g.quizScore != null ? g.quizScore : '—',
          g.assignmentScore != null ? g.assignmentScore : '—',
          g.finalScore != null ? g.finalScore : '—',
          g.grade,
          g.gradePoint.toFixed(2),
        ]),
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [15, 118, 110] },
          6: { halign: 'center', fontStyle: 'bold' },
          7: { halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // CGPA summary row
    if (y > 260) { doc.addPage(); y = 15; }
    doc.setFillColor(30, 41, 59); doc.roundedRect(14, y, W - 28, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Cumulative GPA (CGPA): ${cgpa.toFixed(2)}  —  ${getCgpaLabel(cgpa)}`, W / 2, y + 6.5, { align: 'center' });
    y += 16;
  }

  // ── Enrolled Courses ──────────────────────────────────────────────────────
  if (sections.courses) {
    const enrolled = student.enrolledCourses || [];
    if (y > 230) { doc.addPage(); y = 15; }
    sectionBand(`📚 Currently Enrolled Courses (${enrolled.length})`, [79, 70, 229]);

    if (enrolled.length === 0) {
      doc.setFontSize(10); doc.setTextColor(100, 116, 139);
      doc.text('No courses currently enrolled.', 14, y);
      y += 10;
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Code', 'Course Name', 'Major', 'Credits', 'Year', 'Semester', 'Instructor']],
        body: enrolled.map(c => [
          c.courseCode || '—',
          c.courseName || '—',
          c.major || 'Shared',
          c.credits || '—',
          c.year ? `Year ${c.year}` : '—',
          c.semester || '—',
          c.instructor || '—',
        ]),
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 243, 255] },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [79, 70, 229] }, 3: { halign: 'center' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252); doc.rect(0, pH - 12, W, 12, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text(`HNU Portal — Student Report: ${student.firstName} ${student.lastName} (${student.studentId})`, 14, pH - 4);
    doc.text(`Page ${i} of ${pageCount}`, W - 14, pH - 4, { align: 'right' });
  }

  const fn = `HNU_Report_${student.firstName}_${student.lastName}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fn);
};

// ── Excel generator ───────────────────────────────────────────────────────────
const generateStudentExcel = async (sections, student, gradesData) => {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();
  const cgpa  = gradesData?.cgpa || 0;
  const grades = gradesData?.grades || [];
  const now   = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  // ── Info sheet ──────────────────────────────────────────────────────────────
  if (sections.info) {
    const enrolled = student.enrolledCourses || [];
    const totalCredits = enrolled.reduce((s, c) => s + (c.credits || 0), 0);
    const infoData = [
      ['HNU University Portal — Student Report'],
      [`Generated: ${now}`],
      [],
      ['Field', 'Value'],
      ['Full Name',   `${student.firstName} ${student.lastName}`],
      ['Student ID',  student.studentId || '—'],
      ['Email',       student.email || '—'],
      ['Major',       student.major || '—'],
      ['Year',        student.year ? `Year ${student.year}` : '—'],
      ['Group',       student.lectureGroup ? `Group ${student.lectureGroup} — Section ${student.section}` : '—'],
      ['CGPA',        +cgpa.toFixed(2)],
      ['Standing',    getCgpaLabel(cgpa)],
      ['Enrolled Courses', enrolled.length],
      ['Total Credits', totalCredits],
      ['Graded Courses', grades.length],
    ];
    const ws = XLSX.utils.aoa_to_sheet(infoData);
    ws['!cols'] = [{ wch: 22 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Student Info');
  }

  // ── Grades sheet — full detail ───────────────────────────────────────────
  if (sections.grades && grades.length > 0) {
    const passGP = 1.0;
    const passCount = grades.filter(g => g.gradePoint >= passGP).length;
    const failCount = grades.length - passCount;
    const totalCreditsAttempted = grades.reduce((s, g) => s + (g.course?.credits || 0), 0);
    const totalCreditsEarned    = grades.filter(g => g.gradePoint >= passGP).reduce((s, g) => s + (g.course?.credits || 0), 0);

    const calcTotal = (g) => {
      const q = g.quizScore != null ? Number(g.quizScore) : null;
      const a = g.assignmentScore != null ? Number(g.assignmentScore) : null;
      const f = g.finalScore != null ? Number(g.finalScore) : null;
      if (q == null && a == null && f == null) return '—';
      return +((q||0)+(a||0)+(f||0)).toFixed(1);
    };

    const gradesHeader = [
      'Semester', 'Year', 'Course Code', 'Course Name', 'Major', 'Course Year', 'Sem No.',
      'Credits', 'Instructor',
      'Quiz Score', 'Assignment Score', 'Final Score', 'Total (/100)',
      'Letter Grade', 'GPA Points', 'Weighted Points', 'Status', 'Retake'
    ];
    const gradesRows = [
      [`HNU University Portal — Grade Record: ${student.firstName} ${student.lastName} (${student.studentId || ''})`],
      [`CGPA: ${cgpa.toFixed(2)}  |  Pass: ${passCount}  |  Fail: ${failCount}  |  Credits Earned: ${totalCreditsEarned}/${totalCreditsAttempted}  |  Generated: ${now}`],
      [],
      gradesHeader,
      ...grades.map(g => {
        const credits  = g.course?.credits || 0;
        const weighted = +(g.gradePoint * credits).toFixed(2);
        const status   = g.gradePoint >= passGP ? 'PASS' : 'FAIL';
        return [
          g.semester || '—',
          g.year || '—',
          g.course?.courseCode || '—',
          g.course?.courseName || '—',
          g.course?.major || 'Shared',
          g.course?.year ? `Year ${g.course.year}` : '—',
          g.course?.semester || '—',
          credits,
          g.course?.instructor || '—',
          g.quizScore != null ? +g.quizScore : '—',
          g.assignmentScore != null ? +g.assignmentScore : '—',
          g.finalScore != null ? +g.finalScore : '—',
          calcTotal(g),
          g.grade || '—',
          +g.gradePoint.toFixed(2),
          weighted,
          status,
          g.isRetake ? 'Yes' : 'No',
        ];
      }),
      [],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', 'CGPA →', +cgpa.toFixed(2), '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(gradesRows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 6  }, { wch: 13 }, { wch: 30 }, { wch: 10 }, { wch: 11 }, { wch: 7 },
      { wch: 8  }, { wch: 22 },
      { wch: 11 }, { wch: 17 }, { wch: 12 }, { wch: 13 },
      { wch: 14 }, { wch: 11 }, { wch: 16 }, { wch: 8 }, { wch: 7 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Grades');
  }

  // ── Enrolled courses sheet ──────────────────────────────────────────────────
  if (sections.courses) {
    const enrolled = student.enrolledCourses || [];
    const courseRows = [
      ['Course Code', 'Course Name', 'Major', 'Credits', 'Year', 'Semester', 'Instructor'],
      ...enrolled.map(c => [
        c.courseCode || '—',
        c.courseName || '—',
        c.major || 'Shared',
        c.credits || '—',
        c.year ? `Year ${c.year}` : '—',
        c.semester || '—',
        c.instructor || '—',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(courseRows);
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 8 },
                   { wch: 7 }, { wch: 9 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Enrolled Courses');
  }

  const fn = `HNU_Report_${student.firstName}_${student.lastName}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fn);
};

// ── Report modal ──────────────────────────────────────────────────────────────
const StudentReportModal = ({ student, gradesData, adminUser, onClose }) => {
  const [sections, setSections] = useState({ info: true, grades: true, courses: true });
  const [generating, setGenerating] = useState(false);
  const [genType,    setGenType]    = useState(null);
  const toggle = (k) => setSections(s => ({ ...s, [k]: !s[k] }));

  const OPTS = [
    { key: 'info',    icon: '👤', label: 'Student Information', desc: 'Name, ID, major, year, group, CGPA badge' },
    { key: 'grades',  icon: '📊', label: 'Academic Grades',     desc: 'Full grade table per semester + CGPA summary' },
    { key: 'courses', icon: '📚', label: 'Enrolled Courses',    desc: 'All currently enrolled courses with details' },
  ];
  const hasSelection = OPTS.some(o => sections[o.key]);

  const handleGenerate = async (type) => {
    setGenerating(true); setGenType(type);
    try {
      if (type === 'excel') await generateStudentExcel(sections, student, gradesData);
      else                  await generateStudentPDF(sections, student, gradesData, adminUser);
    } catch (e) { alert('Report error: ' + e.message); }
    finally { setGenerating(false); setGenType(null); }
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={e => e.stopPropagation()}>
        <div className="report-modal-header">
          <div>
            <h2>📄 Student Report</h2>
            <p>{student.firstName} {student.lastName} — {student.studentId}</p>
          </div>
          <button className="report-close" onClick={onClose}>✕</button>
        </div>

        <div className="report-options">
          {OPTS.map(o => (
            <label key={o.key} className={`report-option ${sections[o.key] ? 'selected' : ''}`}>
              <input type="checkbox" checked={sections[o.key]} onChange={() => toggle(o.key)} />
              <span className="report-option-icon">{o.icon}</span>
              <div className="report-option-text">
                <strong>{o.label}</strong>
                <span>{o.desc}</span>
              </div>
              <span className={`report-option-check ${sections[o.key] ? 'on' : ''}`}>{sections[o.key] ? '✓' : ''}</span>
            </label>
          ))}
        </div>

        <div className="report-preview">
          <span className="report-preview-label">Includes:</span>
          {OPTS.filter(o => sections[o.key]).map(o => (
            <span key={o.key} className="report-preview-chip">{o.icon} {o.label}</span>
          ))}
          {!hasSelection && <span style={{ color:'#ef4444', fontSize:13 }}>Select at least one section</span>}
        </div>

        <div className="report-modal-footer">
          <button className="report-cancel" onClick={onClose}>Cancel</button>
          <button className="report-generate report-generate--excel"
            onClick={() => handleGenerate('excel')}
            disabled={generating || !hasSelection}>
            {generating && genType === 'excel' ? '⏳ Generating…' : '📊 Download Excel'}
          </button>
          <button className="report-generate"
            onClick={() => handleGenerate('pdf')}
            disabled={generating || !hasSelection}>
            {generating && genType === 'pdf' ? '⏳ Generating…' : '⬇️ Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: adminUser } = useAuth();
  const { t } = useLanguage();
  const isSuperAdmin = adminUser?.role === 'admin' || adminUser?.role === 'superadmin';

  const [student, setStudent]       = useState(null);
  const [gradesData, setGradesData] = useState({ grades: [], cgpa: 0 });
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab]   = useState('overview');
  const [showReport, setShowReport] = useState(false);

  // Edit panel state
  const [editName, setEditName]           = useState({ firstName: '', lastName: '' });
  const [editGroup, setEditGroup]         = useState({ lectureGroup: '', section: '' });
  const [resetPwd, setResetPwd]           = useState('');
  const [addCourseId, setAddCourseId]     = useState('');
  const [saving, setSaving]               = useState('');
  const [msg, setMsg]                     = useState({ text: '', ok: true });

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 3500); };

  const refetch = async () => {
    const res = await studentAPI.getStudentById(id);
    setStudent(res.data);
    setEditName({ firstName: res.data.firstName, lastName: res.data.lastName });
    setEditGroup({ lectureGroup: res.data.lectureGroup || '', section: res.data.section || '' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentRes, gradesRes, coursesRes] = await Promise.all([
          studentAPI.getStudentById(id),
          gradeAPI.getStudentGradesById(id).catch(() => ({ data: { grades: [], cgpa: 0 } })),
          courseAPI.getAllCourses().catch(() => ({ data: [] })),
        ]);
        setStudent(studentRes.data);
        setGradesData(gradesRes.data || { grades: [], cgpa: 0 });
        setAllCourses(coursesRes.data || []);
        setEditName({ firstName: studentRes.data.firstName, lastName: studentRes.data.lastName });
        setEditGroup({ lectureGroup: studentRes.data.lectureGroup || '', section: studentRes.data.section || '' });
      } catch (err) {
        console.error('Error:', err);
        setFetchError(err.response?.data?.message || err.message || 'Failed to load student');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // ── Actions ──────────────────────────────────────
  const saveName = async () => {
    setSaving('name');
    try {
      await studentAPI.updateStudent(id, editName);
      await refetch();
      showMsg('✅ Name updated');
    } catch { showMsg('❌ Failed', false); }
    setSaving('');
  };

  const saveGroup = async () => {
    setSaving('group');
    try {
      await studentAPI.updateStudent(id, { lectureGroup: editGroup.lectureGroup, section: editGroup.section });
      await refetch();
      showMsg('✅ Group / Section updated');
    } catch { showMsg('❌ Failed', false); }
    setSaving('');
  };

  const handleResetPassword = async () => {
    setSaving('pwd');
    try {
      const pwd = resetPwd.trim() || 'student123';
      const res = await studentAPI.resetPassword(id, pwd);
      showMsg('✅ ' + res.data.message);
      setResetPwd('');
    } catch { showMsg('❌ Failed', false); }
    setSaving('');
  };

  const handleAddCourse = async () => {
    if (!addCourseId) { showMsg('❌ Select a course', false); return; }
    setSaving('add');
    try {
      const res = await studentAPI.addCourseToStudent(id, addCourseId);
      setStudent(res.data);
      setAddCourseId('');
      showMsg('✅ Course added');
    } catch (e) { showMsg('❌ ' + (e.response?.data?.message || 'Failed'), false); }
    setSaving('');
  };

  const handleRemoveCourse = async (courseId) => {
    if (!window.confirm('Remove this course from the student?')) return;
    setSaving('remove-' + courseId);
    try {
      const res = await studentAPI.removeCourseFromStudent(id, courseId);
      setStudent(res.data);
      showMsg('✅ Course removed');
    } catch (e) { showMsg('❌ ' + (e.response?.data?.message || 'Failed'), false); }
    setSaving('');
  };

  // ── Helpers ───────────────────────────────────────

  const buildSchedule = () => {
    const schedule = {};
    DAYS_ORDER.forEach(day => { schedule[day] = {}; });
    (student?.enrolledCourses || []).forEach((course, idx) => {
      (course.schedule?.days || []).forEach(day => {
        if (schedule[day] !== undefined)
          schedule[day][course.schedule?.time || ''] = { course, color: COLORS[idx % COLORS.length] };
      });
    });
    return schedule;
  };

  const activeDays = DAYS_ORDER.filter(day =>
    (student?.enrolledCourses || []).some(c => c.schedule?.days?.includes(day))
  );

  if (loading) return <div className="sp-loading"><div className="sp-spinner"></div><p>Loading...</p></div>;
  if (fetchError) return <div className="sp-error"><p>⚠️ {fetchError}</p><button onClick={() => navigate(-1)}>← Go Back</button></div>;
  if (!student) return <div className="sp-error"><p>Student not found.</p><button onClick={() => navigate(-1)}>← Go Back</button></div>;

  const schedule    = buildSchedule();
  const cgpa        = gradesData?.cgpa || 0;
  const grades      = gradesData?.grades || [];
  const enrolledCourses = student.enrolledCourses || [];
  const enrolledIds     = enrolledCourses.map(c => c._id);
  const availableCourses = allCourses.filter(c => {
    if (enrolledIds.includes(c._id)) return false;
    const isShared = !c.major || c.major === 'Shared' || c.major === 'shared';
    const matchesMajor = c.major === student.major;
    return isShared || matchesMajor;
  });

  const gradesBySemester = grades.reduce((acc, g) => {
    const key = `${g.semester} ${g.year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <div className="student-profile">
      {showReport && (
        <StudentReportModal
          student={student}
          gradesData={gradesData}
          adminUser={adminUser}
          onClose={() => setShowReport(false)}
        />
      )}

      <div className="sp-top-bar">
        <button className="sp-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <button className="report-trigger-btn" onClick={() => setShowReport(true)}>📄 Download Report</button>
      </div>

      {/* Floating message */}
      {msg.text && (
        <div className={`sp-float-msg ${msg.ok ? 'sp-float-ok' : 'sp-float-err'}`}>{msg.text}</div>
      )}

      {/* Hero */}
      <div className="sp-hero">
        <div className="sp-avatar">
          {student.profilePicture ? (
            <img src={student.profilePicture.startsWith('data:') ? student.profilePicture : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/${student.profilePicture}`}
              alt={`${student.firstName} ${student.lastName}`} className="sp-avatar-img" />
          ) : (<>{student.firstName?.[0]}{student.lastName?.[0]}</>)}
        </div>
        <div className="sp-hero-info">
          <h1>{student.firstName} {student.lastName}</h1>
          <p className="sp-subtitle">{student.studentId} · {student.email}</p>
          <p className="sp-meta">
            {student.major} · Year {student.year}
            {student.lectureGroup ? ` · Group ${student.lectureGroup} — Section ${student.section}` : ''}
          </p>
        </div>
        <div className="sp-cgpa-card" style={{ borderColor: getCgpaColor(cgpa) }}>
          <div className="sp-cgpa-value" style={{ color: getCgpaColor(cgpa) }}>{cgpa}</div>
          <div className="sp-cgpa-label">CGPA</div>
          <div className="sp-cgpa-status" style={{ color: getCgpaColor(cgpa) }}>{getCgpaLabel(cgpa)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="sp-stats-row">
        <div className="sp-stat"><div className="sp-stat-value">{enrolledCourses.length}</div><div className="sp-stat-label">Enrolled</div></div>
        <div className="sp-stat"><div className="sp-stat-value">{grades.length}</div><div className="sp-stat-label">Grades</div></div>
        <div className="sp-stat"><div className="sp-stat-value">{enrolledCourses.reduce((s,c)=>s+(c.credits||0),0)}</div><div className="sp-stat-label">Credits</div></div>
        {student.lectureGroup && <div className="sp-stat"><div className="sp-stat-value">G{student.lectureGroup}</div><div className="sp-stat-label">Group</div></div>}
        {student.section      && <div className="sp-stat"><div className="sp-stat-value">S{student.section}</div><div className="sp-stat-label">Section</div></div>}
        <div className="sp-stat"><div className="sp-stat-value" style={{ color: getCgpaColor(cgpa) }}>{cgpa}</div><div className="sp-stat-label">CGPA</div></div>
      </div>

      {/* Tabs */}
      <div className="sp-tabs">
        {['overview','grades','schedule', ...(isSuperAdmin ? ['manage'] : [])].map(tab => (
          <button key={tab} className={`sp-tab ${activeTab===tab?'active':''}`} onClick={() => setActiveTab(tab)}>
            {tab==='overview'&&'📋 Overview'}
            {tab==='grades'&&'📊 Grades'}
            {tab==='schedule'&&'📅 Schedule'}
            {tab==='manage'&&'⚙️ Manage'}
          </button>
        ))}
      </div>

      <div className="sp-content">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="sp-overview">
            <div className="sp-section">
              <h2>📚 Enrolled Courses ({enrolledCourses.length})</h2>
              {enrolledCourses.length > 0 ? (
                <div className="sp-courses-grid">
                  {enrolledCourses.map((course, idx) => (
                    <div key={course._id} className="sp-course-card" style={{ borderLeftColor: COLORS[idx % COLORS.length] }}>
                      <div className="sp-course-code" style={{ color: COLORS[idx % COLORS.length] }}>{course.courseCode}</div>
                      <div className="sp-course-name">{course.courseName}</div>
                      <div className="sp-course-meta">
                        <span>👤 {course.instructor}</span>
                        <span>📚 {course.credits} credits</span>
                      </div>
                      {course.schedule?.days?.length > 0 && (
                        <div className="sp-course-schedule">🕒 {course.schedule.days.join(', ')} · {course.schedule.time}</div>
                      )}
                      {course.prerequisites?.length > 0 && (
                        <div className="sp-prereq-list">
                          <strong>Prerequisites:</strong>
                          {course.prerequisites.map((p,i) => <span key={i} className="sp-prereq-tag">{p}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <div className="sp-empty">No enrolled courses</div>}
            </div>
          </div>
        )}

        {/* GRADES */}
        {activeTab === 'grades' && (
          <div className="sp-grades">
            {grades.length > 0 ? Object.entries(gradesBySemester).map(([semester, semGrades]) => (
              <div key={semester} className="sp-section">
                <h2>📅 {semester}</h2>
                <div className="sp-grades-table">
                  <div className="sp-table-header"><span>Course</span><span>Code</span><span>Grade</span><span>Points</span></div>
                  {semGrades.map(g => (
                    <div key={g._id} className="sp-table-row">
                      <span>{g.course?.courseName||'N/A'}</span>
                      <span className="sp-course-code-badge">{g.course?.courseCode||'N/A'}</span>
                      <span className="sp-grade-badge" style={{color:getCgpaColor(g.gradePoint)}}>{g.grade}</span>
                      <span>{g.gradePoint.toFixed(1)}</span>
                    </div>
                  ))}
                  <div className="sp-table-footer">
                    <span>Semester Average</span><span></span><span></span>
                    <span style={{color:getCgpaColor(semGrades.reduce((s,g)=>s+g.gradePoint,0)/semGrades.length)}}>
                      {(semGrades.reduce((s,g)=>s+g.gradePoint,0)/semGrades.length).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )) : <div className="sp-empty">No grades recorded yet</div>}
          </div>
        )}

        {/* SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="sp-schedule">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:16 }}>
              <h2>📅 Weekly Schedule</h2>
              {enrolledCourses.length > 0 && (() => {
                // Build slots from enrolled courses for export
                const slots = [];
                enrolledCourses.forEach(course => {
                  (course.schedule?.days || []).forEach(day => {
                    slots.push({
                      day, courseCode: course.courseCode, courseName: course.courseName,
                      startTime: course.schedule?.time?.split('–')[0]?.trim() || course.schedule?.time || '',
                      endTime: course.schedule?.time?.split('–')[1]?.trim() || '',
                      type: 'lecture', venue: course.schedule?.room || '',
                      staffName: course.instructor || '',
                    });
                  });
                });
                const fileBase = `HNU_${student.firstName}_${student.lastName}_Schedule`;
                return (
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="report-trigger-btn report-trigger-btn--excel"
                      onClick={() => exportScheduleExcel({ slots, title: `${student.firstName} ${student.lastName} — Schedule`, subtitle: `ID: ${student.studentId}`, fileName: fileBase + '.xlsx' })}>
                      📊 Excel
                    </button>
                    <button className="report-trigger-btn"
                      onClick={() => exportSchedulePDF({ slots, title: `${student.firstName} ${student.lastName} — Schedule`, subtitle: `ID: ${student.studentId}`, fileName: fileBase + '.pdf' })}>
                      📄 PDF
                    </button>
                  </div>
                );
              })()}
            </div>
            {enrolledCourses.length > 0 ? (
              <>
                <div className="sp-timetable">
                  <div className="sp-timetable-header" style={{ gridTemplateColumns: `80px repeat(${activeDays.length}, 1fr)` }}>
                    <div className="sp-time-col"></div>
                    {activeDays.map(day => <div key={day} className="sp-day-header">{day.slice(0,3)}</div>)}
                  </div>
                  {HOURS.map(hour => (
                    <div key={hour} className="sp-timetable-row" style={{ gridTemplateColumns: `80px repeat(${activeDays.length}, 1fr)` }}>
                      <div className="sp-time-label">{hour}</div>
                      {activeDays.map(day => {
                        const slot = schedule[day]?.[hour];
                        return (
                          <div key={day} className="sp-slot">
                            {slot && <div className="sp-slot-content" style={{background:slot.color}}>
                              <div className="sp-slot-code">{slot.course.courseCode}</div>
                              <div className="sp-slot-name">{slot.course.courseName}</div>
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="sp-legend">
                  {enrolledCourses.map((course,idx) => (
                    <div key={course._id} className="sp-legend-item">
                      <div className="sp-legend-color" style={{background:COLORS[idx%COLORS.length]}}></div>
                      <span>{course.courseCode} - {course.courseName}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="sp-empty">No courses enrolled</div>}
          </div>
        )}

        {/* MANAGE (superadmin only) */}
        {activeTab === 'manage' && isSuperAdmin && (
          <div className="sp-manage">

            {/* Edit Name */}
            <div className="sp-manage-card">
              <h3>✏️ Edit Name</h3>
              <div className="sp-manage-row">
                <input value={editName.firstName} onChange={e=>setEditName({...editName,firstName:e.target.value})} placeholder="First Name" />
                <input value={editName.lastName}  onChange={e=>setEditName({...editName,lastName:e.target.value})}  placeholder="Last Name" />
                <button className="sp-btn-save" onClick={saveName} disabled={saving==='name'}>
                  {saving==='name'?'Saving…':'Save Name'}
                </button>
              </div>
            </div>

            {/* Change Group / Section */}
            <div className="sp-manage-card">
              <h3>👥 Change Group & Section</h3>
              <div className="sp-manage-row">
                <select value={editGroup.lectureGroup} onChange={e=>setEditGroup({...editGroup,lectureGroup:e.target.value})}>
                  <option value="">— Group —</option>
                  {[1,2,3,4,5,6].map(g=><option key={g} value={g}>Group {g}</option>)}
                </select>
                <select value={editGroup.section} onChange={e=>setEditGroup({...editGroup,section:e.target.value})}>
                  <option value="">— Section —</option>
                  <option value="1">Section 1</option>
                  <option value="2">Section 2</option>
                </select>
                <button className="sp-btn-save" onClick={saveGroup} disabled={saving==='group'}>
                  {saving==='group'?'Saving…':'Save Group'}
                </button>
              </div>
            </div>

            {/* Add Course */}
            <div className="sp-manage-card">
              <h3>➕ Add Course</h3>
              <div className="sp-manage-row">
                <select value={addCourseId} onChange={e=>setAddCourseId(e.target.value)} style={{flex:2}}>
                  <option value="">— Select course to add —</option>
                  {availableCourses.map(c=>(
                    <option key={c._id} value={c._id}>[{c.courseCode}] {c.courseName} ({c.credits}cr)</option>
                  ))}
                </select>
                <button className="sp-btn-save" onClick={handleAddCourse} disabled={saving==='add'}>
                  {saving==='add'?'Adding…':'Add Course'}
                </button>
              </div>
            </div>

            {/* Remove Course */}
            <div className="sp-manage-card">
              <h3>➖ Remove Course</h3>
              {enrolledCourses.length === 0
                ? <p className="sp-empty-small">No enrolled courses</p>
                : <div className="sp-remove-list">
                    {enrolledCourses.map(course => (
                      <div key={course._id} className="sp-remove-item">
                        <div>
                          <span className="sp-remove-code">{course.courseCode}</span>
                          <span className="sp-remove-name">{course.courseName}</span>
                          <span className="sp-remove-credits">{course.credits} cr</span>
                        </div>
                        <button className="sp-btn-remove" onClick={()=>handleRemoveCourse(course._id)} disabled={saving==='remove-'+course._id}>
                          {saving==='remove-'+course._id ? '…' : '✕ Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Reset Password */}
            <div className="sp-manage-card">
              <h3>🔑 Reset Password</h3>
              <div className="sp-manage-row">
                <input type="text" value={resetPwd} onChange={e=>setResetPwd(e.target.value)}
                  placeholder="New password (leave blank for 'student123')" style={{flex:2}} />
                <button className="sp-btn-danger" onClick={handleResetPassword} disabled={saving==='pwd'}>
                  {saving==='pwd'?'Resetting…':'Reset Password'}
                </button>
              </div>
              <p className="sp-manage-hint">Leaving blank resets to the default password: <code>student123</code></p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;



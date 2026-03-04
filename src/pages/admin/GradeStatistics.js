import React, { useState, useEffect } from 'react';
import { gradeAPI, pageCache } from '../../services/api';
import { useAuth, isSuperAdmin, isDoctor, isAssistant, isAnyAdmin } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import './GradeStatistics.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const getGradeColor = (gp) => {
  if (gp >= 3.4) return '#22c55e';
  if (gp >= 3.0) return '#4facfe';
  if (gp >= 2.2) return '#f59e0b';
  if (gp >= 1.0) return '#f97316';
  return '#ef4444';
};

const gradeFromPoint = (gp) => {
  if (gp >= 4.0) return 'A+';
  if (gp >= 3.7) return 'A';
  if (gp >= 3.4) return 'A-';
  if (gp >= 3.2) return 'B+';
  if (gp >= 3.0) return 'B';
  if (gp >= 2.8) return 'B-';
  if (gp >= 2.6) return 'C+';
  if (gp >= 2.4) return 'C';
  if (gp >= 2.2) return 'C-';
  if (gp >= 2.0) return 'D+';
  if (gp >= 1.5) return 'D';
  if (gp >= 1.0) return 'D-';
  return 'F';
};

const gradeClass = (g) => {
  const map = { 'A+':'a-plus','A':'a','A-':'a-minus','B+':'b-plus','B':'b','B-':'b-minus','C+':'c-plus','C':'c','C-':'c-minus','D+':'d-plus','D':'d','D-':'d-minus','F':'f' };
  return 'grade-' + (map[g] || (g || '').toLowerCase());
};

// ── PDF REPORT GENERATOR ─────────────────────────────────────────────────────
const generatePDF = async (sections, data, user) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const role = user.role?.charAt(0).toUpperCase() + user.role?.slice(1);
  let y = 0;

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HNU University Portal', W / 2, 12, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Academic Grade Report', W / 2, 20, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${now}  |  By: ${user.firstName} ${user.lastName} (${role})`, W / 2, 27, { align: 'center' });
  y = 40;

  const addSectionTitle = (title, color = [30, 41, 59]) => {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFillColor(...color);
    doc.roundedRect(14, y, W - 28, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 19, y + 6);
    doc.setTextColor(30, 41, 59);
    y += 13;
  };

  const addKPIRow = (kpis) => {
    if (y > 255) { doc.addPage(); y = 15; }
    const boxW = (W - 28 - (kpis.length - 1) * 4) / kpis.length;
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (boxW + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, boxW, 18, 2, 2, 'FD');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const [r, g, b] = kpi.color || [30, 41, 59];
      doc.setTextColor(r, g, b);
      doc.text(String(kpi.value), x + boxW / 2, y + 9, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + boxW / 2, y + 15, { align: 'center' });
    });
    y += 23;
  };

  const { courses = [], majors = [], dist = [] } = data;
  const gradedCourses = courses.filter(c => c.totalStudents > 0);
  const totalStudents = courses.reduce((s, c) => s + c.totalStudents, 0);
  const avgGPA = gradedCourses.length
    ? (gradedCourses.reduce((s, c) => s + c.averageGradePoint, 0) / gradedCourses.length).toFixed(2)
    : '0.00';
  const passCount = courses.reduce((s, c) => s + c.passCount, 0);
  const passRate = totalStudents ? ((passCount / totalStudents) * 100).toFixed(1) : '0';

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  if (sections.summary) {
    addSectionTitle('📊 Summary Overview', [30, 41, 59]);
    addKPIRow([
      { label: 'Total Courses',    value: courses.length,    color: [99, 102, 241] },
      { label: 'Graded Courses',   value: gradedCourses.length, color: [34, 197, 94] },
      { label: 'Avg GPA (graded)', value: avgGPA,            color: [79, 172, 254] },
      { label: 'Total Records',    value: totalStudents,     color: [245, 158, 11] },
      { label: 'Pass Rate',        value: `${passRate}%`,    color: [34, 197, 94] },
    ]);
  }

  // ── Grade Distribution ────────────────────────────────────────────────────
  if (sections.distribution && dist.length > 0) {
    addSectionTitle('📈 Grade Distribution', [79, 70, 229]);
    const GRADE_COLORS = {
      'A+': [34,197,94], 'A': [74,222,128], 'A-': [134,239,172],
      'B+': [79,172,254], 'B': [96,165,250], 'B-': [147,197,253],
      'C+': [245,158,11], 'C': [251,191,36], 'C-': [253,224,71],
      'D+': [249,115,22], 'D': [251,146,60],
      'F':  [239,68,68],
    };
    const total = dist.reduce((s, d) => s + d.count, 0);
    const barX = 14, barY = y, barH = 10, barW = W - 28;
    let bx = barX;
    dist.forEach(d => {
      const pct = total ? d.count / total : 0;
      const segW = pct * barW;
      if (segW < 0.5) return;
      const col = GRADE_COLORS[d._id] || [100, 116, 139];
      doc.setFillColor(...col);
      doc.rect(bx, barY, segW, barH, 'F');
      bx += segW;
    });
    y += barH + 3;
    // Legend
    let lx = 14;
    dist.forEach(d => {
      const col = GRADE_COLORS[d._id] || [100, 116, 139];
      doc.setFillColor(...col);
      doc.rect(lx, y, 4, 4, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`${d._id}: ${d.count}`, lx + 6, y + 3.5);
      lx += 22;
      if (lx > W - 30) { lx = 14; y += 7; }
    });
    y += 10;
  }

  // ── Course Statistics ─────────────────────────────────────────────────────
  if (sections.courses && courses.length > 0) {
    if (y > 220) { doc.addPage(); y = 15; }
    addSectionTitle('📚 Course Statistics', [15, 118, 110]);
    const rows = (sections.gradedOnly ? gradedCourses : courses).map(c => [
      c.courseCode || '',
      c.courseName || '',
      c.major || 'Shared',
      `Y${c.year || '?'} · ${c.semester || '?'}`,
      c.totalStudents,
      c.averageGradePoint > 0 ? c.averageGradePoint.toFixed(2) : '—',
      c.averageGradePoint > 0 ? gradeFromPoint(c.averageGradePoint) : '—',
      c.passCount,
      c.failCount,
      c.totalStudents > 0 ? `${((c.passCount / c.totalStudents) * 100).toFixed(0)}%` : '—',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Course Name', 'Major', 'Year/Sem', 'Students', 'Avg GPA', 'Grade', 'Pass', 'Fail', 'Pass%']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 118, 110] },
        5: { halign: 'center' },
        6: { halign: 'center', fontStyle: 'bold' },
        7: { halign: 'center', textColor: [34, 197, 94] },
        8: { halign: 'center', textColor: [239, 68, 68] },
        9: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (d) => { y = d.cursor.y + 5; },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Major Statistics ──────────────────────────────────────────────────────
  if (sections.majors && majors.length > 0) {
    if (y > 230) { doc.addPage(); y = 15; }
    addSectionTitle('🎓 Statistics by Major', [126, 34, 206]);
    const rows = majors.map(m => [
      m.major || 'Undeclared',
      m.totalStudents,
      m.averageGradePoint?.toFixed(2),
      gradeFromPoint(m.averageGradePoint),
      m.totalGrades,
      `${((m.averageGradePoint / 4) * 100).toFixed(0)}%`,
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Major', 'Students', 'Avg GPA', 'Letter', 'Total Grades', 'Performance']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
      headStyles: { fillColor: [126, 34, 206], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pH - 12, W, 12, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('HNU University Portal — Confidential Academic Report', 14, pH - 4);
    doc.text(`Page ${i} of ${pageCount}`, W - 14, pH - 4, { align: 'right' });
  }

  const fileName = `HNU_Grade_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

// ── EXCEL REPORT GENERATOR ───────────────────────────────────────────────────
const generateExcel = async (sections, data, user) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const role = user.role?.charAt(0).toUpperCase() + user.role?.slice(1);
  const { courses = [], majors = [], dist = [] } = data;
  const gradedCourses = courses.filter(c => c.totalStudents > 0);
  const totalStudents = courses.reduce((s, c) => s + c.totalStudents, 0);
  const avgGPA = gradedCourses.length
    ? (gradedCourses.reduce((s, c) => s + c.averageGradePoint, 0) / gradedCourses.length).toFixed(2)
    : '0.00';
  const passCount = courses.reduce((s, c) => s + c.passCount, 0);
  const passRate  = totalStudents ? ((passCount / totalStudents) * 100).toFixed(1) : '0';

  // ── Summary sheet ──────────────────────────────────────────────────────────
  if (sections.summary) {
    const summaryData = [
      ['HNU University Portal — Academic Grade Report'],
      [`Generated: ${now}  |  By: ${user.firstName} ${user.lastName} (${role})`],
      [],
      ['Metric', 'Value'],
      ['Total Courses',     courses.length],
      ['Graded Courses',    gradedCourses.length],
      ['Average GPA',       parseFloat(avgGPA)],
      ['Total Records',     totalStudents],
      ['Pass Rate (%)',     parseFloat(passRate)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  // ── Grade Distribution sheet ───────────────────────────────────────────────
  if (sections.distribution && dist.length > 0) {
    const distData = [
      ['Grade', 'Count', 'Percentage'],
      ...dist.map(d => {
        const total = dist.reduce((s, x) => s + x.count, 0);
        return [d._id, d.count, total ? +((d.count / total) * 100).toFixed(1) : 0];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(distData);
    ws['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Grade Distribution');
  }

  // ── Course Statistics sheet ────────────────────────────────────────────────
  if (sections.courses && courses.length > 0) {
    const list = sections.gradedOnly ? gradedCourses : courses;
    const courseData = [
      ['Course Code', 'Course Name', 'Major', 'Year', 'Semester', 'Total Students',
       'Avg GPA', 'Letter Grade', 'Pass', 'Fail', 'Pass Rate (%)'],
      ...list.map(c => [
        c.courseCode || '',
        c.courseName || '',
        c.major || 'Shared',
        c.year || '',
        c.semester || '',
        c.totalStudents,
        c.averageGradePoint > 0 ? +c.averageGradePoint.toFixed(2) : 0,
        c.averageGradePoint > 0 ? gradeFromPoint(c.averageGradePoint) : '—',
        c.passCount,
        c.failCount,
        c.totalStudents > 0 ? +((c.passCount / c.totalStudents) * 100).toFixed(1) : 0,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(courseData);
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 6 }, { wch: 9 },
                   { wch: 15 }, { wch: 10 }, { wch: 13 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Course Statistics');
  }

  // ── Major Statistics sheet ─────────────────────────────────────────────────
  if (sections.majors && majors.length > 0) {
    const majorData = [
      ['Major', 'Total Students', 'Avg GPA', 'Letter Grade', 'Total Grades', 'Performance (%)'],
      ...majors.map(m => [
        m.major || 'Undeclared',
        m.totalStudents,
        m.averageGradePoint ? +m.averageGradePoint.toFixed(2) : 0,
        gradeFromPoint(m.averageGradePoint),
        m.totalGrades,
        m.averageGradePoint ? +((m.averageGradePoint / 4) * 100).toFixed(1) : 0,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(majorData);
    ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 13 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Major Statistics');
  }

  const fileName = `HNU_Grade_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ── REPORT MODAL ──────────────────────────────────────────────────────────────
const ReportModal = ({ data, user, onClose }) => {
  const [sections, setSections] = useState({
    summary:      true,
    distribution: true,
    courses:      true,
    majors:       true,
    gradedOnly:   false,
  });
  const [generating, setGenerating] = useState(false);
  const [genType,    setGenType]    = useState(null); // 'pdf' | 'excel'

  const toggle = (key) => setSections(s => ({ ...s, [key]: !s[key] }));

  const handleGenerate = async (type) => {
    setGenerating(true);
    setGenType(type);
    try {
      if (type === 'excel') {
        await generateExcel(sections, data, user);
      } else {
        await generatePDF(sections, data, user);
      }
    } catch (e) {
      console.error('Report error:', e);
      alert('Failed to generate report: ' + e.message);
    } finally {
      setGenerating(false);
      setGenType(null);
    }
  };

  const OPTS = [
    { key: 'summary',      icon: '📊', label: 'Summary KPIs',        desc: 'Courses count, avg GPA, pass rate, total records' },
    { key: 'distribution', icon: '📈', label: 'Grade Distribution',  desc: 'Visual bar + legend of A+/A/B.../F counts' },
    { key: 'courses',      icon: '📚', label: 'Course Statistics',   desc: 'Per-course table: GPA, pass/fail, performance' },
    { key: 'majors',       icon: '🎓', label: 'Major Statistics',    desc: 'Per-major averages and student counts' },
  ];
  const hasSelection = OPTS.some(o => sections[o.key]);

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={e => e.stopPropagation()}>
        <div className="report-modal-header">
          <div>
            <h2>📄 Generate Report</h2>
            <p>Choose sections and download as PDF or Excel</p>
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
              <span className={`report-option-check ${sections[o.key] ? 'on' : ''}`}>
                {sections[o.key] ? '✓' : ''}
              </span>
            </label>
          ))}
          {sections.courses && (
            <label className={`report-option report-suboption ${sections.gradedOnly ? 'selected' : ''}`}>
              <input type="checkbox" checked={sections.gradedOnly} onChange={() => toggle('gradedOnly')} />
              <span className="report-option-icon">🔍</span>
              <div className="report-option-text">
                <strong>Graded courses only</strong>
                <span>Exclude courses with 0 students from the table</span>
              </div>
              <span className={`report-option-check ${sections.gradedOnly ? 'on' : ''}`}>
                {sections.gradedOnly ? '✓' : ''}
              </span>
            </label>
          )}
        </div>

        <div className="report-preview">
          <span className="report-preview-label">Will include:</span>
          {OPTS.filter(o => sections[o.key]).map(o => (
            <span key={o.key} className="report-preview-chip">{o.icon} {o.label}</span>
          ))}
          {!hasSelection && (
            <span style={{ color: '#ef4444', fontSize: 13 }}>Select at least one section</span>
          )}
        </div>

        <div className="report-modal-footer">
          <button className="report-cancel" onClick={onClose}>Cancel</button>
          <button
            className="report-generate report-generate--excel"
            onClick={() => handleGenerate('excel')}
            disabled={generating || !hasSelection}
            title="Download as Excel spreadsheet"
          >
            {generating && genType === 'excel' ? '⏳ Generating…' : '📊 Download Excel'}
          </button>
          <button
            className="report-generate"
            onClick={() => handleGenerate('pdf')}
            disabled={generating || !hasSelection}
            title="Download as PDF document"
          >
            {generating && genType === 'pdf' ? '⏳ Generating…' : '⬇️ Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── GRADE DISTRIBUTION BAR ───────────────────────────────────────────────────
const DistBar = ({ dist }) => {
  const total = dist.reduce((s, d) => s + d.count, 0);
  const ORDER = ['A+','A','B+','B','C+','C','D+','D','F'];
  const COLOR  = { 'A+':'#22c55e','A':'#4ade80','B+':'#4facfe','B':'#60a5fa','C+':'#f59e0b','C':'#fbbf24','D+':'#f97316','D':'#fb923c','F':'#ef4444' };
  const map = Object.fromEntries(dist.map(d => [d._id, d.count]));
  return (
    <div className="gs-dist-wrap">
      <div className="gs-dist-bar">
        {ORDER.map(g => {
          const pct = total ? ((map[g] || 0) / total * 100) : 0;
          if (!pct) return null;
          return (
            <div key={g} className="gs-dist-seg" style={{ width: `${pct}%`, background: COLOR[g] }} title={`${g}: ${map[g] || 0} (${pct.toFixed(1)}%)`} />
          );
        })}
      </div>
      <div className="gs-dist-legend">
        {ORDER.filter(g => map[g]).map(g => (
          <span key={g} className="gs-dist-lbl">
            <span className="gs-dist-dot" style={{ background: COLOR[g] }} />
            {g}: {map[g]}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── STAFF STATS VIEW (doctor / assistant / superadmin) ───────────────────────
const StaffStats = ({ user }) => {
  const { t } = useLanguage();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [search, setSearch]       = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pageCache(`gradeStats:${user?._id}`, () => gradeAPI.getMyStatistics().then(r => r.data), (data, isFresh) => {
      if (!cancelled) { setData(data); if (isFresh) setLoading(false); }
    }).then(() => { if (!cancelled) setLoading(false); })
      .catch(e => { if (!cancelled) { setError(e.response?.data?.message || e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user?._id]); // eslint-disable-line

  if (loading) return <div className="loading"><div className="loading-spinner"/><p>Loading…</p></div>;
  if (error || !data) return (
    <div className="empty-message" style={{ textAlign:'center', padding:40 }}>
      <p style={{ color:'#ef4444', fontWeight:700 }}>⚠️ {error || 'Failed to load statistics'}</p>
      <button onClick={() => window.location.reload()} style={{ marginTop:12, padding:'8px 20px', background:'#374151', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>🔄 Retry</button>
    </div>
  );

  const { courseStatistics: courses, majorStatistics: majors, gradeDistribution: dist = [] } = data;
  const gradedCourses = courses.filter(c => c.totalStudents > 0);
  const totalStudents = courses.reduce((s, c) => s + c.totalStudents, 0);
  const avgGPA = gradedCourses.length
    ? (gradedCourses.reduce((s, c) => s + c.averageGradePoint, 0) / gradedCourses.length).toFixed(2)
    : '0.00';
  const passRate = totalStudents
    ? ((courses.reduce((s, c) => s + c.passCount, 0) / totalStudents) * 100).toFixed(1)
    : '0';

  const years = [...new Set(courses.map(c => c.year).filter(Boolean))].sort();
  const filtered = courses.filter(c => {
    const matchY = yearFilter === 'all' || String(c.year) === yearFilter;
    const q = search.toLowerCase();
    const matchQ = !q || c.courseCode?.toLowerCase().includes(q) || c.courseName?.toLowerCase().includes(q);
    return matchY && matchQ;
  });

  const isStaff = isDoctor(user) || isAssistant(user);
  const reportData = { courses, majors, dist };

  return (
    <div className="grade-statistics">
      {showReport && (
        <ReportModal
          data={reportData}
          user={user}
          onClose={() => setShowReport(false)}
        />
      )}

      <div className="statistics-header">
        <div>
          <h1>📈 Grade Statistics</h1>
          <p>
            {isStaff
              ? `Statistics for your ${courses.length} assigned course${courses.length !== 1 ? 's' : ''}`
              : 'University-wide grade statistics'}
          </p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <button
            className="report-trigger-btn report-trigger-btn--excel"
            onClick={() => generateExcel({ summary:true, distribution:true, courses:true, majors:true, gradedOnly:false }, reportData, user).catch(e => alert('Excel error: '+e.message))}
            title="Download as Excel spreadsheet"
          >
            📊 Excel Report
          </button>
          <button
            className="report-trigger-btn"
            onClick={() => setShowReport(true)}
            title="Customize and export report"
          >
            📄 Export Report
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="gs-kpi-row">
        <div className="gs-kpi"><span className="gs-kpi-val">{courses.length}</span><span className="gs-kpi-lbl">Courses</span></div>
        <div className="gs-kpi"><span className="gs-kpi-val" style={{ color: getGradeColor(parseFloat(avgGPA)) }}>{avgGPA}</span><span className="gs-kpi-lbl">Avg GPA (graded)</span></div>
        <div className="gs-kpi"><span className="gs-kpi-val">{totalStudents}</span><span className="gs-kpi-lbl">Graded Records</span></div>
        <div className="gs-kpi"><span className="gs-kpi-val" style={{ color: '#22c55e' }}>{passRate}%</span><span className="gs-kpi-lbl">Pass Rate</span></div>
      </div>

      {/* Overall grade distribution */}
      {dist.length > 0 && (
        <div className="gs-section">
          <h2 className="gs-section-title">Overall Grade Distribution</h2>
          <DistBar dist={dist} />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>📊 By Course</button>
        <button className={`tab ${activeTab === 'majors'  ? 'active' : ''}`} onClick={() => setActiveTab('majors')}>🎓 By Major</button>
      </div>

      {/* COURSES tab */}
      {activeTab === 'courses' && (
        <div className="statistics-content">
          {/* Filters */}
          <div className="gs-filters">
            <input
              className="gs-search"
              placeholder="🔍 Search course…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="gs-year-tabs">
              {['all', ...years.map(String)].map(y => (
                <button
                  key={y}
                  className={`gs-year-btn ${yearFilter === y ? 'active' : ''}`}
                  onClick={() => setYearFilter(y)}
                >
                  {y === 'all' ? 'All Years' : `Year ${y}`}
                </button>
              ))}
            </div>
          </div>

          <div className="statistics-table">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Major</th>
                  <th>Year / Sem</th>
                  <th>Students</th>
                  <th>Avg GPA</th>
                  <th>Grade</th>
                  <th>Pass</th>
                  <th>Fail</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No courses found.</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <span className="course-code-badge">{c.courseCode}</span>
                      <span className="course-name-cell" style={{ marginLeft:8 }}>{c.courseName}</span>
                    </td>
                    <td><span className="gs-major-badge">{c.major || 'Shared'}</span></td>
                    <td><span style={{ fontSize:12, color:'#64748b' }}>Y{c.year} · {c.semester}</span></td>
                    <td className="center-cell"><span className="student-count">{c.totalStudents}</span></td>
                    <td className="center-cell">
                      <span className="grade-point" style={{ color: c.totalStudents > 0 ? getGradeColor(c.averageGradePoint) : '#94a3b8' }}>
                        {c.totalStudents > 0 ? c.averageGradePoint?.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="center-cell">
                      {c.totalStudents > 0
                        ? <span className="letter-grade" style={{ background: getGradeColor(c.averageGradePoint), color:'#fff' }}>{gradeFromPoint(c.averageGradePoint)}</span>
                        : <span style={{ color:'#94a3b8', fontSize:12 }}>No grades</span>}
                    </td>
                    <td className="center-cell"><span style={{ color:'#22c55e', fontWeight:700 }}>{c.passCount}</span></td>
                    <td className="center-cell"><span style={{ color:'#ef4444', fontWeight:700 }}>{c.failCount}</span></td>
                    <td>
                      <div className="performance-bar">
                        <div className="performance-fill" style={{ width:`${c.totalStudents > 0 ? (c.averageGradePoint/4)*100 : 0}%`, backgroundColor: getGradeColor(c.averageGradePoint) }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAJORS tab */}
      {activeTab === 'majors' && (
        <div className="statistics-content">
          <div className="majors-grid">
            {majors.length === 0
              ? <div className="empty-message"><p>No major data available.</p></div>
              : majors.map((m, i) => (
              <div key={i} className="major-card">
                <div className="major-header">
                  <h3>{m.major || 'Undeclared'}</h3>
                  <span className="student-badge">{m.totalStudents} students</span>
                </div>
                <div className="major-stats">
                  <div className="major-stat-item">
                    <span className="stat-label">Avg GPA</span>
                    <span className="stat-value" style={{ color: getGradeColor(m.averageGradePoint) }}>{m.averageGradePoint}</span>
                  </div>
                  <div className="major-stat-item">
                    <span className="stat-label">Letter</span>
                    <span className="letter-grade-large" style={{ background: getGradeColor(m.averageGradePoint), color:'#fff' }}>{gradeFromPoint(m.averageGradePoint)}</span>
                  </div>
                  <div className="major-stat-item">
                    <span className="stat-label">Total Grades</span>
                    <span className="stat-value-secondary">{m.totalGrades}</span>
                  </div>
                </div>
                <div className="performance-bar-large">
                  <div className="performance-fill" style={{ width:`${(m.averageGradePoint/4)*100}%`, backgroundColor: getGradeColor(m.averageGradePoint) }} />
                </div>
                <div className="performance-label">{((m.averageGradePoint/4)*100).toFixed(0)}% Performance</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── STUDENT VIEW ──────────────────────────────────────────────────────────────
const StudentStats = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [studentGrades, setStudentGrades] = useState([]);
  const [gpaData, setGpaData]             = useState({ gpa: 0, totalCredits: 0 });
  const [loading, setLoading]             = useState(true);
  const [showReport, setShowReport]       = useState(false);

  useEffect(() => {
    Promise.all([gradeAPI.getStudentGrades(), gradeAPI.getGPA()])
      .then(([gr, gr2]) => { setStudentGrades(gr.data); setGpaData(gr2.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="loading-spinner"/><p>Loading…</p></div>;

  const grouped = studentGrades.reduce((acc, g) => {
    const key = `${g.semester} ${g.year}`;
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {});

  const semGPA = (gs) => {
    let pts = 0, cr = 0;
    gs.forEach(g => { if (!g.isRetake || g.gradePoint > 0) { pts += g.gradePoint * g.course.credits; cr += g.course.credits; } });
    return cr > 0 ? (pts / cr).toFixed(2) : '0.00';
  };

  const handleStudentPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, W, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('HNU University Portal', W / 2, 12, { align: 'center' });
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Student Academic Transcript', W / 2, 20, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`${user?.firstName} ${user?.lastName}  |  Generated: ${now}`, W / 2, 27, { align: 'center' });

    let y = 42;
    const kpis = [
      { label: 'Cumulative GPA', value: gpaData.gpa.toFixed(2), color: [99,102,241] },
      { label: 'Total Credits',  value: gpaData.totalCredits,   color: [34,197,94] },
      { label: 'Courses',        value: studentGrades.length,   color: [245,158,11] },
    ];
    const bw = (W - 28 - 8) / 3;
    kpis.forEach((k, i) => {
      const x = 14 + i * (bw + 4);
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, bw, 18, 2, 2, 'FD');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...k.color);
      doc.text(String(k.value), x + bw / 2, y + 9, { align: 'center' });
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(k.label, x + bw / 2, y + 15, { align: 'center' });
    });
    y += 26;

    for (const [sem, gs] of Object.entries(grouped)) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFillColor(30, 41, 59); doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`${sem}   —   Semester GPA: ${semGPA(gs)}`, 19, y + 5.5);
      y += 11;
      autoTable(doc, {
        startY: y,
        head: [['Code', 'Course Name', 'Credits', 'Quiz', 'Assignment', 'Final', 'Grade', 'GPA']],
        body: gs.map(g => [
          g.course.courseCode, g.course.courseName, g.course.credits,
          g.quizScore != null ? g.quizScore : '—',
          g.assignmentScore != null ? g.assignmentScore : '—',
          g.finalScore != null ? g.finalScore : '—',
          g.grade + (g.isRetake ? ' ↩' : ''),
          g.gradePoint.toFixed(2),
        ]),
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 6: { halign: 'center', fontStyle: 'bold' }, 7: { halign: 'center' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      const pH = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 250, 252); doc.rect(0, pH - 12, W, 12, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text('HNU University Portal — Student Transcript', 14, pH - 4);
      doc.text(`Page ${i} of ${pc}`, W - 14, pH - 4, { align: 'right' });
    }
    doc.save(`HNU_Transcript_${user?.firstName}_${user?.lastName}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handleStudentExcel = async () => {
    const XLSX = await import('xlsx');
    const wb   = XLSX.utils.book_new();
    const now  = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    // ── Helper: total score out of 100 ──────────────────────────────────────
    const calcTotal = (g) => {
      const q = g.quizScore != null ? Number(g.quizScore) : null;
      const a = g.assignmentScore != null ? Number(g.assignmentScore) : null;
      const f = g.finalScore != null ? Number(g.finalScore) : null;
      if (q == null && a == null && f == null) return '—';
      return ((q || 0) + (a || 0) + (f || 0)).toFixed(1);
    };

    const passGP = 1.0; // below 1.0 = fail

    // ── Summary sheet ────────────────────────────────────────────────────────
    const passCount = studentGrades.filter(g => g.gradePoint >= passGP).length;
    const failCount = studentGrades.length - passCount;
    const totalCreditAttempted = studentGrades.reduce((s, g) => s + (g.course?.credits || 0), 0);
    const totalCreditEarned    = studentGrades
      .filter(g => g.gradePoint >= passGP)
      .reduce((s, g) => s + (g.course?.credits || 0), 0);

    const summaryData = [
      ['HNU University Portal — Student Academic Transcript'],
      [`Student: ${user?.firstName} ${user?.lastName}  |  ID: ${user?.studentId || '—'}  |  Generated: ${now}`],
      [],
      ['Metric',                'Value'],
      ['Cumulative GPA (CGPA)', +gpaData.gpa.toFixed(2)],
      ['Total Credits Earned',  totalCreditEarned],
      ['Total Credits Attempted', totalCreditAttempted],
      ['Total Courses Graded',  studentGrades.length],
      ['Courses Passed',        passCount],
      ['Courses Failed',        failCount],
      ['Pass Rate (%)',         studentGrades.length ? +((passCount / studentGrades.length) * 100).toFixed(1) : 0],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ── Full Grades sheet — ALL info ─────────────────────────────────────────
    const gradesHeader = [
      'Semester', 'Year', 'Course Code', 'Course Name', 'Major', 'Course Year',
      'Sem No.', 'Credits', 'Instructor',
      'Quiz Score', 'Assignment Score', 'Final Score', 'Total Score (/100)',
      'Letter Grade', 'GPA Points', 'Weighted Points', 'Status', 'Retake'
    ];
    const gradesRows = studentGrades.map(g => {
      const credits = g.course?.credits || 0;
      const weighted = +(g.gradePoint * credits).toFixed(2);
      const total = calcTotal(g);
      const status = g.gradePoint >= passGP ? 'PASS' : 'FAIL';
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
        total,
        g.grade || '—',
        +g.gradePoint.toFixed(2),
        weighted,
        status,
        g.isRetake ? 'Yes' : 'No',
      ];
    });

    const allGradesData = [
      ['HNU University Portal — Full Grade Record'],
      [`${user?.firstName} ${user?.lastName}  |  CGPA: ${gpaData.gpa.toFixed(2)}  |  Generated: ${now}`],
      [],
      gradesHeader,
      ...gradesRows,
      [],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', 'CGPA →', +gpaData.gpa.toFixed(2), '', '', ''],
    ];
    const wsAll = XLSX.utils.aoa_to_sheet(allGradesData);
    wsAll['!cols'] = [
      { wch: 12 }, { wch: 6  }, { wch: 13 }, { wch: 30 }, { wch: 10 }, { wch: 11 },
      { wch: 7  }, { wch: 8  }, { wch: 22 },
      { wch: 11 }, { wch: 17 }, { wch: 12 }, { wch: 18 },
      { wch: 14 }, { wch: 11 }, { wch: 16 }, { wch: 8 }, { wch: 7 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Grades');

    // ── Per-semester sheets ──────────────────────────────────────────────────
    for (const [sem, gs] of Object.entries(grouped)) {
      const semHeader = [
        'Course Code', 'Course Name', 'Major', 'Credits',
        'Quiz', 'Assignment', 'Final', 'Total (/100)',
        'Grade', 'GPA Points', 'Weighted', 'Status', 'Retake'
      ];
      const semGPAVal = semGPA(gs);
      const semRows = gs.map(g => {
        const credits  = g.course?.credits || 0;
        const weighted = +(g.gradePoint * credits).toFixed(2);
        const status   = g.gradePoint >= passGP ? 'PASS' : 'FAIL';
        return [
          g.course?.courseCode || '—',
          g.course?.courseName || '—',
          g.course?.major || 'Shared',
          credits,
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
      });
      const semSheetData = [
        [`Semester: ${sem}  |  Semester GPA: ${semGPAVal}`],
        [`Student: ${user?.firstName} ${user?.lastName}  |  Generated: ${now}`],
        [],
        semHeader,
        ...semRows,
        [],
        ['', '', '', '', '', '', '', '', 'Sem GPA →', +semGPAVal, '', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(semSheetData);
      ws['!cols'] = [
        { wch: 13 }, { wch: 28 }, { wch: 10 }, { wch: 8 },
        { wch: 7  }, { wch: 12 }, { wch: 7  }, { wch: 13 },
        { wch: 8  }, { wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 7 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, sem.slice(0, 31));
    }

    XLSX.writeFile(wb, `HNU_Transcript_${user?.firstName}_${user?.lastName}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="grade-statistics">
      <div className="statistics-header">
        <div>
          <h1>My Academic Performance</h1>
          <p>View your grades and GPA by semester</p>
        </div>
        <button className="report-trigger-btn report-trigger-btn--excel" onClick={handleStudentExcel}>📊 Excel</button>
        <button className="report-trigger-btn" onClick={handleStudentPDF}>📄 PDF Transcript</button>
      </div>
      <div className="gpa-display-large">
        <div className="gpa-main-large">
          <div className="gpa-label-large">Cumulative GPA</div>
          <div className="gpa-value-large">{gpaData.gpa.toFixed(2)}</div>
          <div className="gpa-scale-large">/ 4.0</div>
        </div>
        <div className="gpa-info-grid">
          <div className="info-item"><span className="info-label">Total Credits</span><span className="info-value">{gpaData.totalCredits}</span></div>
          <div className="info-item"><span className="info-label">Courses Completed</span><span className="info-value">{studentGrades.length}</span></div>
        </div>
      </div>
      {Object.keys(grouped).length === 0
        ? <div className="empty-message"><p>No grades available yet.</p></div>
        : (
          <div className="semesters-container">
            {Object.entries(grouped).map(([sem, gs]) => (
              <div key={sem} className="semester-section">
                <div className="semester-header">
                  <h2>{sem}</h2>
                  <span className="semester-gpa-badge">Semester GPA: {semGPA(gs)}</span>
                </div>
                <div className="statistics-table">
                  <table>
                    <thead><tr><th>Code</th><th>Course Name</th><th>Credits</th><th>Grade</th><th>Grade Point</th></tr></thead>
                    <tbody>
                      {gs.map(g => (
                        <tr key={g._id}>
                          <td><span className="course-code-badge">{g.course.courseCode}</span></td>
                          <td className="course-name-cell">{g.course.courseName}{g.isRetake && <span style={{marginLeft:6,fontSize:10,color:'#d97706'}}>↩ Retook</span>}</td>
                          <td className="center-cell"><span className="student-count">{g.course.credits}</span></td>
                          <td className="center-cell"><span className={`grade-badge ${gradeClass(g.grade)}`}>{g.grade}</span></td>
                          <td className="center-cell"><span className="grade-point" style={{ color: getGradeColor(g.gradePoint) }}>{g.gradePoint.toFixed(2)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

// ── ROOT ──────────────────────────────────────────────────────────────────────
const GradeStatistics = () => {
  const { user } = useAuth();
  if (!user) return <div className="loading"><div className="loading-spinner"/></div>;
  if (isAnyAdmin(user)) return <StaffStats user={user} />;
  return <StudentStats />;
};

export default GradeStatistics;


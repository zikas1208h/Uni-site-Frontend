import React, { useState, useEffect, useCallback } from 'react';
import { scheduleAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import './Schedule.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];
const TYPE_STYLE = {
  lecture: { bg: '#6366f115', border: '#6366f140', color: '#6366f1', labelKey: 'schedule.lecture', icon: '🎓' },
  section: { bg: '#22c55e15', border: '#22c55e40', color: '#22c55e', labelKey: 'schedule.section', icon: '📋' },
  lab:     { bg: '#f59e0b15', border: '#f59e0b40', color: '#f59e0b', labelKey: 'schedule.section', icon: '🔬' },
};
const DAY_KEYS = { Sunday:'sunday', Monday:'monday', Tuesday:'tuesday', Wednesday:'wednesday', Thursday:'thursday', Friday:'friday', Saturday:'saturday' };

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2,'0')} ${ampm}`;
};

const groupByDay = (slots, days) => {
  const map = {};
  days.forEach(d => { map[d] = []; });
  (slots || []).forEach(s => { if (map[s.day] !== undefined) map[s.day].push(s); });
  return map;
};

// ── Shared: export schedule as PDF ──────────────────────────────────────────
export const exportSchedulePDF = async ({ slots, title, subtitle, fileName }) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  // Header band
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text('HNU University Portal', W/2, 10, { align:'center' });
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text(title || 'Schedule', W/2, 18, { align:'center' });
  doc.setFontSize(7); doc.setTextColor(148,163,184);
  doc.text(`${subtitle || ''}   Generated: ${now}`, W/2, 25, { align:'center' });

  let y = 34;

  // Group by day and render a table per day
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Saturday'];
  const byDay = {};
  days.forEach(d => { byDay[d] = []; });
  (slots || []).forEach(s => { if (byDay[s.day] !== undefined) byDay[s.day].push(s); });

  days.filter(d => byDay[d].length > 0).forEach(day => {
    if (y > 160) { doc.addPage(); y = 15; }
    // Day header band
    doc.setFillColor(51, 65, 85);
    doc.roundedRect(14, y, W-28, 7, 1, 1, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text(`📅 ${day}  (${byDay[day].length} slot${byDay[day].length!==1?'s':''})`, 18, y+5);
    y += 9;

    const rows = byDay[day]
      .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''))
      .map(s => [
        `${fmt(s.startTime)} – ${fmt(s.endTime)}`,
        s.courseCode || '—',
        s.courseName || '—',
        s.type ? s.type.charAt(0).toUpperCase()+s.type.slice(1) : '—',
        s.group ? `G${s.group}` : '—',
        s.section ? `S${s.section}` : '—',
        s.venue || s.room || '—',
        s.staffName || '—',
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Time','Code','Course Name','Type','Group','Section','Venue','Staff']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30,41,59] },
      headStyles: { fillColor: [99,102,241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: {
        0: { fontStyle:'bold', whiteSpace:'nowrap', cellWidth: 28 },
        1: { fontStyle:'bold', textColor:[99,102,241], cellWidth: 16 },
        2: { cellWidth: 55 },
        3: { halign:'center', cellWidth: 18 },
        4: { halign:'center', cellWidth: 14 },
        5: { halign:'center', cellWidth: 16 },
        6: { cellWidth: 24 },
        7: { cellWidth: 30 },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  });

  // Footer on every page
  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFillColor(248,250,252); doc.rect(0, pH-10, W, 10, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text('HNU University Portal — Schedule', 14, pH-3.5);
    doc.text(`Page ${i} of ${pc}`, W-14, pH-3.5, { align:'right' });
  }

  doc.save(fileName || `HNU_Schedule_${new Date().toISOString().slice(0,10)}.pdf`);
};

// ── Shared: export schedule as Excel ────────────────────────────────────────
export const exportScheduleExcel = async ({ slots, title, subtitle, fileName }) => {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();
  const now  = new Date().toLocaleString('en-US', { dateStyle:'long', timeStyle:'short' });
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Saturday'];

  // All slots — flat sheet
  const allRows = [
    [title || 'HNU Schedule'],
    [`${subtitle || ''}  Generated: ${now}`],
    [],
    ['Day','Time','Course Code','Course Name','Type','Group','Section','Venue','Staff','Staff Role'],
    ...(slots||[])
      .sort((a,b) => days.indexOf(a.day)-days.indexOf(b.day) || (a.startTime||'').localeCompare(b.startTime||''))
      .map(s => [
        s.day,
        `${fmt(s.startTime)} – ${fmt(s.endTime)}`,
        s.courseCode || '—',
        s.courseName || '—',
        s.type ? s.type.charAt(0).toUpperCase()+s.type.slice(1) : '—',
        s.group ? `Group ${s.group}` : '—',
        s.section ? `Section ${s.section}` : '—',
        s.venue || s.room || '—',
        s.staffName || '—',
        s.staffRole || '—',
      ]),
  ];
  const wsAll = XLSX.utils.aoa_to_sheet(allRows);
  wsAll['!cols'] = [{ wch:12 },{ wch:18 },{ wch:12 },{ wch:30 },{ wch:10 },{ wch:9 },{ wch:10 },{ wch:18 },{ wch:22 },{ wch:12 }];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Full Schedule');

  // Per-day sheets
  days.forEach(day => {
    const daySlots = (slots||[]).filter(s => s.day === day).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
    if (!daySlots.length) return;
    const rows = [
      ['Time','Course Code','Course Name','Type','Group','Section','Venue','Staff'],
      ...daySlots.map(s => [
        `${fmt(s.startTime)} – ${fmt(s.endTime)}`,
        s.courseCode||'—', s.courseName||'—',
        s.type ? s.type.charAt(0).toUpperCase()+s.type.slice(1) : '—',
        s.group ? `Group ${s.group}` : '—',
        s.section ? `Section ${s.section}` : '—',
        s.venue||s.room||'—', s.staffName||'—',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch:18 },{ wch:12 },{ wch:30 },{ wch:10 },{ wch:9 },{ wch:10 },{ wch:18 },{ wch:22 }];
    XLSX.utils.book_append_sheet(wb, ws, day.slice(0,31));
  });

  XLSX.writeFile(wb, fileName || `HNU_Schedule_${new Date().toISOString().slice(0,10)}.xlsx`);
};

const Schedule = () => {
  const { t } = useLanguage();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting]   = useState(null); // 'pdf' | 'excel'
  const [error, setError]       = useState(null);
  const [view, setView]         = useState('week');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await scheduleAPI.getMySchedule();
      setSchedule(r.data);
    } catch (e) {
      if (e.response?.status === 404) setSchedule(null);
      else setError(e.response?.data?.message || 'Failed to load schedule');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const r = await scheduleAPI.generateMySchedule();
      setSchedule(r.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to generate schedule');
    } finally { setGenerating(false); }
  };

  const handleExport = async (type) => {
    if (!schedule?.slots?.length) return;
    setExporting(type);
    try {
      const opts = {
        slots: schedule.slots,
        title: 'My Weekly Schedule',
        subtitle: `${schedule.semester} ${schedule.year}`,
        fileName: `HNU_My_Schedule_${new Date().toISOString().slice(0,10)}.${type === 'pdf' ? 'pdf' : 'xlsx'}`,
      };
      if (type === 'pdf') await exportSchedulePDF(opts);
      else                await exportScheduleExcel(opts);
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { setExporting(null); }
  };

  if (loading) return (
    <div className="sched-page">
      <div className="sched-loader"><div className="sched-spinner"/><p>{t('schedule.loading')}</p></div>
    </div>
  );

  const slots    = schedule?.slots || [];
  const byDay    = groupByDay(slots, DAYS);
  const activeDays = DAYS.filter(d => byDay[d]?.length > 0);

  return (
    <div className="sched-page">
      {/* Header */}
      <div className="sched-header">
        <div>
          <h1>📅 {t('schedule.title')}</h1>
          <p>
            {schedule
              ? `${schedule.semester} ${schedule.year} · ${slots.length} sessions · ${new Date(schedule.generatedAt).toLocaleDateString()}`
              : t('schedule.noSchedule')}
          </p>
        </div>
        <div className="sched-header-actions">
          {schedule && (
            <div className="sched-view-toggle">
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>📆 {t('schedule.day')}</button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>📋 List</button>
            </div>
          )}
          {schedule && slots.length > 0 && (
            <>
              <button className="sched-btn-export sched-btn-export--excel"
                onClick={() => handleExport('excel')} disabled={!!exporting}>
                {exporting === 'excel' ? '⏳' : '📊'} Excel
              </button>
              <button className="sched-btn-export"
                onClick={() => handleExport('pdf')} disabled={!!exporting}>
                {exporting === 'pdf' ? '⏳' : '📄'} PDF
              </button>
            </>
          )}
          <button className="sched-btn-generate" onClick={generate} disabled={generating}>
            {generating ? `⏳ ${t('schedule.loading')}` : schedule ? `🔄 Regenerate` : `⚡ ${t('schedule.title')}`}
          </button>
        </div>
      </div>

      {error && <div className="sched-alert">{error}</div>}

      {/* No schedule yet */}
      {!schedule && !error && (
        <div className="sched-empty">
          <span>📅</span>
          <h3>{t('schedule.noSchedule')}</h3>
          <p>Click <strong>Generate Schedule</strong> to automatically build your weekly timetable.</p>
          <button className="sched-btn-generate" onClick={generate} disabled={generating}>
            {generating ? `⏳ ${t('schedule.loading')}` : `⚡ Generate My Schedule`}
          </button>
        </div>
      )}

      {/* Summary chips */}
      {schedule && slots.length > 0 && (
        <div className="sched-summary">
          {Object.entries(slots.reduce((acc, s) => { acc[s.type] = (acc[s.type]||0)+1; return acc; }, {})).map(([type, count]) => {
            const st = TYPE_STYLE[type] || TYPE_STYLE.lecture;
            const label = t(st.labelKey);
            return (
              <div key={type} className="sched-chip" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                {st.icon} {count} {label}
              </div>
            );
          })}
          <div className="sched-chip" style={{ background:'#94a3b815', border:'1px solid #94a3b830', color:'#94a3b8' }}>
            📅 {activeDays.length} {activeDays.length === 1 ? t('schedule.day') : `${t('schedule.day')}s`}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {schedule && view === 'week' && slots.length > 0 && (
        <div className="sched-week">
          {DAYS.filter(d => byDay[d]?.length > 0).map(day => (
            <div key={day} className="sched-day-col">
              <div className="sched-day-header">
                <span className="sched-day-full">{t(`schedule.${DAY_KEYS[day]}`) || day}</span>
                <span className="sched-day-short">{(t(`schedule.${DAY_KEYS[day]}`) || day).slice(0,3)}</span>
                <span className="sched-day-count">{byDay[day].length}</span>
              </div>
              <div className="sched-day-slots">
                {byDay[day].map((slot, i) => {
                  const st = TYPE_STYLE[slot.type] || TYPE_STYLE.lecture;
                  return (
                    <div key={i} className="sched-slot" style={{ background:st.bg, borderLeft:`4px solid ${st.color}`, borderTop:`1px solid ${st.border}`, borderRight:`1px solid ${st.border}`, borderBottom:`1px solid ${st.border}` }}>
                      <div className="sched-slot-time">
                        <span>{fmt(slot.startTime)}</span><span className="sched-slot-sep">–</span><span>{fmt(slot.endTime)}</span>
                      </div>
                      <div className="sched-slot-course">
                        <span className="sched-course-code">{slot.courseCode}</span>
                        <span className="sched-course-name">{slot.courseName}</span>
                      </div>
                      <div className="sched-slot-meta">
                        <span className="sched-type-badge" style={{ background:st.color+'20', color:st.color }}>
                          {st.icon} {t(st.labelKey)}
                          {slot.group   ? ` · Group ${slot.group}`   : ''}
                          {slot.type !== 'lecture' && slot.section ? ` · Section ${slot.section}` : ''}
                        </span>
                        {slot.venue && <span className="sched-room">📍 {slot.venue}</span>}
                        {!slot.venue && slot.room && <span className="sched-room">📍 {slot.room}</span>}
                        {slot.staffName && (
                          <span className="sched-room" style={{color:'#6366f1'}}>
                            {slot.staffRole === 'doctor' ? '🎓' : '📋'} {slot.staffName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {schedule && view === 'list' && slots.length > 0 && (
        <div className="sched-list">
          {DAYS.filter(d => byDay[d]?.length > 0).map(day => (
            <div key={day} className="sched-list-day">
              <div className="sched-list-day-header">
                <span>{t(`schedule.${DAY_KEYS[day]}`) || day}</span>
                <span className="sched-list-day-count">{byDay[day].length}</span>
              </div>
              {byDay[day].map((slot, i) => {
                const st = TYPE_STYLE[slot.type] || TYPE_STYLE.lecture;
                return (
                  <div key={i} className="sched-list-row" style={{ borderLeft:`4px solid ${st.color}` }}>
                    <div className="sched-list-time">
                      <span>{fmt(slot.startTime)}</span><span className="sched-list-time-sep">→</span><span>{fmt(slot.endTime)}</span>
                    </div>
                    <div className="sched-list-info">
                      <p className="sched-list-course">{slot.courseCode} — {slot.courseName}</p>
                      <div className="sched-list-badges">
                        <span className="sched-type-badge" style={{ background:st.color+'20', color:st.color }}>
                          {st.icon} {t(st.labelKey)}
                          {slot.group   ? ` · Group ${slot.group}`   : ''}
                          {slot.type !== 'lecture' && slot.section ? ` · Section ${slot.section}` : ''}
                        </span>
                        {slot.venue && <span className="sched-room">📍 {slot.venue}</span>}
                        {!slot.venue && slot.room && <span className="sched-room">📍 {slot.room}</span>}
                        {slot.staffName && (
                          <span className="sched-room" style={{color:'#6366f1'}}>
                            {slot.staffRole === 'doctor' ? '🎓' : '📋'} {slot.staffName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {schedule && slots.length === 0 && (
        <div className="sched-empty"><span>😕</span><h3>{t('schedule.noSchedule')}</h3></div>
      )}
    </div>
  );
};

export default Schedule;


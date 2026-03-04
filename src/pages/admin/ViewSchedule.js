/**
 * ViewSchedule — Admin / Doctor / Assistant view of the master schedule.
 *
 * • Shows the full master timetable (all groups, all sections)
 * • Filter bar: by day, by course, by type (lecture/section), by group/section
 * • Staff members see ONLY the slots they personally teach highlighted
 * • Week-grid view + list view toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { scheduleAPI } from '../../services/api';
import { useAuth, isSuperAdmin } from '../../context/AuthContext';
import { exportSchedulePDF, exportScheduleExcel } from '../Schedule';
import './ViewSchedule.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];

const TYPE_STYLE = {
  lecture: { bg: '#6366f115', border: '#6366f140', color: '#6366f1', icon: '🎓', label: 'Lecture' },
  section: { bg: '#22c55e15', border: '#22c55e40', color: '#22c55e', icon: '📋', label: 'Section' },
  lab:     { bg: '#f59e0b15', border: '#f59e0b40', color: '#f59e0b', icon: '🔬', label: 'Lab'     },
};

const VENUE_ICON = (v = '') => {
  const l = (v || '').toLowerCase();
  if (l.includes('amph'))  return '🏛️';
  if (l.includes('lab'))   return '🔬';
  if (l.includes('room'))  return '🚪';
  return '📍';
};

const VENUE_COLOR = (type) => {
  if (type === 'amphitheatre') return { color: '#6366f1', bg: '#6366f112' };
  if (type === 'lab')          return { color: '#f59e0b', bg: '#f59e0b12' };
  return                              { color: '#22c55e', bg: '#22c55e12' };
};

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const groupByDay = (slots) => {
  const map = {};
  DAYS.forEach(d => { map[d] = []; });
  (slots || []).forEach(s => { if (map[s.day] !== undefined) map[s.day].push(s); });
  return map;
};

// ─────────────────────────────────────────────────────────────────────────────
const ViewSchedule = () => {
  const { user } = useAuth();
  const myId       = user?._id?.toString() || user?.id?.toString() || '';
  const superAdmin = isSuperAdmin(user);
  const isStaff    = !superAdmin && (user?.role === 'doctor' || user?.role === 'assistant');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [master,   setMaster]   = useState(null);
  const [venues,   setVenues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [vLoading, setVLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(null); // { tab, type }

  const handleExport = async (type, slotsToExport, title, subtitle, fileBase) => {
    setExporting({ type });
    try {
      const opts = {
        slots: slotsToExport,
        title,
        subtitle,
        fileName: `${fileBase}_${new Date().toISOString().slice(0,10)}.${type === 'pdf' ? 'pdf' : 'xlsx'}`,
      };
      if (type === 'pdf') await exportSchedulePDF(opts);
      else                await exportScheduleExcel(opts);
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { setExporting(null); }
  };

  // ── Tabs — staff defaults to their own schedule tab ───────────────────────
  const [tab, setTab] = useState(isStaff ? 'mystaff' : 'schedule');

  // ── Schedule filters ──────────────────────────────────────────────────────
  const [view,          setView]          = useState('week');
  const [filterDay,     setFilterDay]     = useState('All');
  const [filterType,    setFilterType]    = useState('All');
  const [filterCourse,  setFilterCourse]  = useState('All');
  const [filterGroup,   setFilterGroup]   = useState('All');
  const [filterSection, setFilterSection] = useState('All');
  const [myOnly,        setMyOnly]        = useState(false);

  // ── Venue filters ─────────────────────────────────────────────────────────
  const [venueType, setVenueType] = useState('All');
  const [venueDay,  setVenueDay]  = useState('All');
  const [freeOnly,  setFreeOnly]  = useState(false);

  // ── Group schedule ────────────────────────────────────────────────────────
  const [selGroup,     setSelGroup]     = useState(1);
  const [selSection,   setSelSection]   = useState(1);
  const [groupSlots,   setGroupSlots]   = useState(null);
  const [gLoading,     setGLoading]     = useState(false);
  const [forcing,      setForcing]      = useState(false);
  const [forceResult,  setForceResult]  = useState(null);
  const [gError,       setGError]       = useState('');

  // ── Staff personal schedule ───────────────────────────────────────────────
  const [staffSlots,    setStaffSlots]    = useState(null);
  const [staffList,     setStaffList]     = useState([]);
  const [selStaffId,    setSelStaffId]    = useState('');
  const [sLoading,      setSLoading]      = useState(false);
  const [sError,        setSError]        = useState('');
  const [forcingStaff,  setForcingStaff]  = useState(false);
  const [forceStaffRes, setForceStaffRes] = useState(null);

  // ── Load schedule ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await scheduleAPI.getMaster();
      setMaster(r.data);
    } catch (e) {
      if (e.response?.status === 404) setMaster(null);
      else setError(e.response?.data?.message || 'Failed to load schedule.');
    } finally { setLoading(false); }
  }, []);

  // ── Load venues ───────────────────────────────────────────────────────────
  const loadVenues = useCallback(async () => {
    setVLoading(true);
    try {
      const r = await scheduleAPI.getVenues();
      setVenues(r.data.venues || []);
    } catch (e) { console.error('venues error', e); }
    finally { setVLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'venues') loadVenues(); }, [tab, loadVenues]);

  // ── Load group schedule preview ───────────────────────────────────────────
  const loadGroupSchedule = useCallback(async (g, s) => {
    setGLoading(true); setGError(''); setGroupSlots(null); setForceResult(null);
    try {
      const r = await scheduleAPI.getGroupSchedule(g, s);
      setGroupSlots(r.data);
    } catch (e) {
      setGError(e.response?.data?.message || 'Failed to load group schedule.');
    } finally { setGLoading(false); }
  }, []);

  // Load when tab switches to 'group' OR when group/section changes while on the tab
  useEffect(() => {
    if (tab === 'group') loadGroupSchedule(selGroup, selSection);
  }, [tab, selGroup, selSection, loadGroupSchedule]);

  // ── Load staff personal schedule ──────────────────────────────────────────
  const loadStaffSchedule = useCallback(async (staffId) => {
    setSLoading(true); setSError(''); setForceStaffRes(null);
    try {
      let r;
      if (isStaff) {
        r = await scheduleAPI.getMyStaffSchedule();
      } else {
        if (!staffId) { setSLoading(false); return; }
        r = await scheduleAPI.getStaffSchedule(staffId);
      }
      setStaffSlots(r.data);
    } catch (e) {
      setSError(e.response?.data?.message || 'Failed to load schedule.');
    } finally { setSLoading(false); }
  }, [isStaff]);

  // For admin: load staff list on tab enter, then auto-select first
  const loadStaffList = useCallback(async () => {
    try {
      const r = await scheduleAPI.getStaffList();
      const list = r.data || [];
      setStaffList(list);
      // auto-select first staff member that has slots
      const first = list.find(s => s.slotCount > 0) || list[0];
      if (first && !selStaffId) setSelStaffId(String(first._id));
    } catch (e) { console.error('staff list error', e); }
  }, [selStaffId]);

  useEffect(() => {
    if (tab === 'mystaff') {
      if (isStaff) {
        loadStaffSchedule(null);
      } else {
        loadStaffList();
      }
    }
  }, [tab]); // eslint-disable-line

  // When admin selects a different staff member, auto-load
  useEffect(() => {
    if (tab === 'mystaff' && superAdmin && selStaffId) {
      loadStaffSchedule(selStaffId);
    }
  }, [selStaffId, tab]); // eslint-disable-line

  // ── Force push all staff schedules (superadmin) ───────────────────────────
  const handleForceStaffAll = async () => {
    if (!window.confirm('Push personal schedules to ALL doctors and assistants?\nThis overwrites their existing saved schedules.')) return;
    setForcingStaff(true); setForceStaffRes(null);
    try {
      const r = await scheduleAPI.forceStaffAll();
      setForceStaffRes(r.data);
    } catch (e) {
      setSError(e.response?.data?.message || 'Failed.');
    } finally { setForcingStaff(false); }
  };

  // ── Force push to all students in group/section ───────────────────────────
  const handleForce = async () => {
    if (!window.confirm(
      `⚠️ Force schedule on ALL students in Group ${selGroup} Section ${selSection}?\n\nThis overwrites their existing schedule.`
    )) return;
    setForcing(true); setForceResult(null); setGError('');
    try {
      const r = await scheduleAPI.forceGroupSchedule(selGroup, selSection);
      setForceResult(r.data);
    } catch (e) {
      setGError(e.response?.data?.message || 'Failed to force schedule.');
    } finally { setForcing(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('⚠️ Delete the master schedule?\n\nThis also clears ALL student schedules. Cannot be undone.')) return;
    setDeleting(true); setError('');
    try { await scheduleAPI.deleteMaster(); setMaster(null); }
    catch (e) { setError(e.response?.data?.message || 'Failed to delete.'); }
    finally { setDeleting(false); }
  };

  // ── Schedule filtering ────────────────────────────────────────────────────
  const allSlots   = master?.slots || [];
  const courseList = [...new Set(allSlots.map(s => s.courseCode))].sort();
  const filtered   = allSlots.filter(s => {
    if (filterDay     !== 'All' && s.day             !== filterDay)        return false;
    if (filterType    !== 'All' && s.type            !== filterType)       return false;
    if (filterCourse  !== 'All' && s.courseCode      !== filterCourse)     return false;
    if (filterGroup   !== 'All' && String(s.group)   !== filterGroup)      return false;
    if (filterSection !== 'All' && String(s.section) !== filterSection)    return false;
    if (myOnly && String(s.staffId) !== myId) return false;
    return true;
  });
  const byDay  = groupByDay(filtered);
  const counts = filtered.reduce((a, s) => { a[s.type] = (a[s.type]||0)+1; return a; }, {});

  // ── Venue filtering ───────────────────────────────────────────────────────
  const filteredVenues = venues.filter(v =>
    (venueType === 'All' || v.type === venueType)
  );
  const daysToShow = venueDay === 'All' ? DAYS : [venueDay];

  // ── Slot card ─────────────────────────────────────────────────────────────
  const SlotCard = ({ slot }) => {
    const st   = TYPE_STYLE[slot.type] || TYPE_STYLE.lecture;
    const mine = String(slot.staffId) === myId;
    return (
      <div className={`vs-slot ${mine ? 'vs-slot--mine' : ''}`}
        style={{ background:st.bg, borderLeft:`4px solid ${st.color}`, border:`1px solid ${st.border}`, borderLeftWidth:4 }}>
        <div className="vs-slot-time">{fmt(slot.startTime)}<span className="vs-sep">–</span>{fmt(slot.endTime)}</div>
        <div className="vs-slot-body">
          <div className="vs-slot-course">
            <span className="vs-code">{slot.courseCode}</span>
            <span className="vs-name">{slot.courseName}</span>
          </div>
          <div className="vs-slot-pills">
            {/* Type badge */}
            <span className="vs-pill" style={{ background:st.color+'22', color:st.color }}>
              {st.icon} {st.label}
            </span>
            {/* Group badge — always shown */}
            {slot.group && (
              <span className="vs-pill vs-pill--group">
                👥 Group {slot.group}
              </span>
            )}
            {/* Section badge — only for sections, not lectures */}
            {slot.type !== 'lecture' && slot.section && (
              <span className="vs-pill vs-pill--section">
                §  Section {slot.section}
              </span>
            )}
            {/* Venue */}
            {slot.venue && <span className="vs-pill vs-pill--venue">{VENUE_ICON(slot.venue)} {slot.venue}</span>}
            {/* Staff */}
            {slot.staffName && (
              <span className={`vs-pill ${mine ? 'vs-pill--mine' : 'vs-pill--staff'}`}>
                {slot.staffRole === 'doctor' ? '🎓' : '📋'} {slot.staffName}{mine ? ' ✦ You' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="vs-page"><div className="vs-loader"><div className="vs-spinner"/><p>Loading schedule…</p></div></div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vs-page">

      {/* ── Header ── */}
      <div className="vs-header">
        <div>
          <h1>📅 Master Schedule</h1>
          <p>{master
            ? `${master.semester} ${master.year} · ${allSlots.length} slots · Generated ${new Date(master.generatedAt).toLocaleDateString()}`
            : 'No schedule generated yet'}
          </p>
        </div>
        <div className="vs-header-actions">
          {master && (
            <div className="vs-view-toggle">
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>📆 Week</button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>📋 List</button>
            </div>
          )}
          {isStaff && master && (
            <button className={`vs-btn ${myOnly ? 'vs-btn--active' : ''}`} onClick={() => setMyOnly(v => !v)}>
              {myOnly ? '✦ My Slots' : '👤 My Slots Only'}
            </button>
          )}
          {master && filtered.length > 0 && (
            <>
              <button className="vs-btn vs-btn--excel"
                onClick={() => handleExport('excel', filtered, 'Master Schedule', `${master.semester} ${master.year} · ${filtered.length} slots`, 'HNU_MasterSchedule')}
                disabled={!!exporting}>
                {exporting?.type === 'excel' ? '⏳' : '📊'} Excel
              </button>
              <button className="vs-btn vs-btn--pdf"
                onClick={() => handleExport('pdf', filtered, 'Master Schedule', `${master.semester} ${master.year} · ${filtered.length} slots`, 'HNU_MasterSchedule')}
                disabled={!!exporting}>
                {exporting?.type === 'pdf' ? '⏳' : '📄'} PDF
              </button>
            </>
          )}
          <button className="vs-btn" onClick={() => { load(); loadVenues(); }}>🔄 Refresh</button>
          {superAdmin && master && (
            <button className="vs-btn vs-btn--danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '⏳ Deleting…' : '🗑️ Delete Schedule'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="vs-alert vs-alert--err">{error}</div>}

      {/* ── Tabs ── */}
      <div className="vs-tabs">
        {/* Full timetable — visible to all */}
        <button className={`vs-tab ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')}>📅 Timetable</button>
        {/* Staff personal schedule — doctors and assistants */}
        {(isStaff || superAdmin) && (
          <button className={`vs-tab ${tab === 'mystaff' ? 'active' : ''}`} onClick={() => setTab('mystaff')}>
            {isStaff ? '🗓️ My Schedule' : '👨‍🏫 Staff Schedules'}
          </button>
        )}
        {/* Group schedule — superadmin only */}
        {superAdmin && (
          <button className={`vs-tab ${tab === 'group' ? 'active' : ''}`} onClick={() => setTab('group')}>👥 Group Schedule</button>
        )}
        {/* Venue availability — all */}
        <button className={`vs-tab ${tab === 'venues' ? 'active' : ''}`} onClick={() => setTab('venues')}>🏛️ Venue Availability</button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SCHEDULE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'schedule' && (
        <>
          {!master ? (
            <div className="vs-empty">
              <span>📅</span>
              <h3>No master schedule yet</h3>
              <p>Go to <strong>Schedule Config</strong> → generate a master schedule first.</p>
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="vs-summary">
                {Object.entries(counts).map(([type, count]) => {
                  const st = TYPE_STYLE[type] || TYPE_STYLE.lecture;
                  return (
                    <div key={type} className="vs-chip" style={{ background:st.bg, border:`1px solid ${st.border}`, color:st.color }}>
                      {st.icon} {count} {st.label}{count!==1?'s':''}
                    </div>
                  );
                })}
                {filtered.length !== allSlots.length && (
                  <div className="vs-chip vs-chip--filter">🔍 {filtered.length} of {allSlots.length}</div>
                )}
              </div>

              {/* Filter bar */}
              <div className="vs-filters">
                <div className="vs-filter-group">
                  <label>Day</label>
                  <select value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                    <option value="All">All days</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="vs-filter-group">
                  <label>Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="All">All types</option>
                    <option value="lecture">🎓 Lecture</option>
                    <option value="section">📋 Section</option>
                  </select>
                </div>
                <div className="vs-filter-group">
                  <label>Course</label>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
                    <option value="All">All courses</option>
                    {courseList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="vs-filter-group">
                  <label>Group</label>
                  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                    <option value="All">All groups</option>
                    {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Group {g}</option>)}
                  </select>
                </div>
                <div className="vs-filter-group">
                  <label>Section</label>
                  <select value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                    <option value="All">All sections</option>
                    <option value="1">Section 1</option>
                    <option value="2">Section 2</option>
                  </select>
                </div>
                {(filterDay!=='All'||filterType!=='All'||filterCourse!=='All'||filterGroup!=='All'||filterSection!=='All'||myOnly) && (
                  <button className="vs-btn vs-btn--reset" onClick={() => {
                    setFilterDay('All'); setFilterType('All'); setFilterCourse('All');
                    setFilterGroup('All'); setFilterSection('All'); setMyOnly(false);
                  }}>✕ Reset</button>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="vs-empty"><span>🔍</span><h3>No slots match filters</h3></div>
              ) : view === 'week' ? (
                <div className="vs-week">
                  {DAYS.filter(d => byDay[d]?.length > 0).map(day => (
                    <div key={day} className="vs-day-col">
                      <div className="vs-day-header">
                        <span className="vs-day-name">{day}</span>
                        <span className="vs-day-count">{byDay[day].length}</span>
                      </div>
                      <div className="vs-day-slots">
                        {byDay[day].sort((a,b) => a.startTime.localeCompare(b.startTime)).map((slot,i) => <SlotCard key={i} slot={slot}/>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="vs-list">
                  {DAYS.filter(d => byDay[d]?.length > 0).map(day => (
                    <div key={day} className="vs-list-day">
                      <div className="vs-list-day-header">
                        <span>{day}</span>
                        <span className="vs-list-day-count">{byDay[day].length} slot{byDay[day].length!==1?'s':''}</span>
                      </div>
                      {byDay[day].sort((a,b) => a.startTime.localeCompare(b.startTime)).map((slot,i) => <SlotCard key={i} slot={slot}/>)}
                    </div>
                  ))}
                </div>
              )}

              {master.warnings?.length > 0 && (
                <details className="vs-warnings">
                  <summary>⚠️ {master.warnings.length} scheduling warning(s)</summary>
                  <ul>{master.warnings.map((w,i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: GROUP SCHEDULE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'group' && (
        <div className="vs-group-tab">

          {/* ── Picker ── */}
          <div className="vs-group-picker">
            <div className="vs-filter-group">
              <label>Group</label>
              <select value={selGroup} onChange={e => { setSelGroup(Number(e.target.value)); setForceResult(null); }}>
                {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Group {g}</option>)}
              </select>
            </div>
            <div className="vs-filter-group">
              <label>Section</label>
              <select value={selSection} onChange={e => { setSelSection(Number(e.target.value)); setForceResult(null); }}>
                <option value={1}>Section 1</option>
                <option value={2}>Section 2</option>
              </select>
            </div>
            {gLoading && <div className="vs-filter-group" style={{justifyContent:'flex-end'}}><label>&nbsp;</label><span style={{padding:'8px 12px',color:'var(--text-secondary)',fontSize:13}}>⏳ Loading…</span></div>}
          </div>

          {gError && <div className="vs-alert vs-alert--err">{gError}</div>}

          {/* ── Force result ── */}
          {forceResult && (
            <div className="vs-force-result">
              ✅ Forced schedule on <strong>{forceResult.pushed}</strong> student(s) in{' '}
              Group {forceResult.group} Section {forceResult.section} —{' '}
              {forceResult.slotsPerStudent} slots each.
            </div>
          )}

          {/* ── Preview ── */}
          {groupSlots && (
            <>
              <div className="vs-group-header">
                <div className="vs-group-title">
                  <span>👥</span>
                  <h2>Group {selGroup} · Section {selSection}</h2>
                  <span className="vs-day-count">{groupSlots.totalSlots} slots</span>
                  <span className="vs-chip vs-chip--filter" style={{marginLeft:4}}>{groupSlots.semester} {groupSlots.year}</span>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  {groupSlots.slots.length > 0 && (
                    <>
                      <button className="vs-btn vs-btn--excel"
                        onClick={() => handleExport('excel', groupSlots.slots,
                          `Group ${selGroup} Section ${selSection} Schedule`,
                          `${groupSlots.semester} ${groupSlots.year}`,
                          `HNU_G${selGroup}S${selSection}_Schedule`)}
                        disabled={!!exporting}>
                        {exporting?.type === 'excel' ? '⏳' : '📊'} Excel
                      </button>
                      <button className="vs-btn vs-btn--pdf"
                        onClick={() => handleExport('pdf', groupSlots.slots,
                          `Group ${selGroup} Section ${selSection} Schedule`,
                          `${groupSlots.semester} ${groupSlots.year}`,
                          `HNU_G${selGroup}S${selSection}_Schedule`)}
                        disabled={!!exporting}>
                        {exporting?.type === 'pdf' ? '⏳' : '📄'} PDF
                      </button>
                    </>
                  )}
                  {superAdmin && (
                    <button
                      className="vs-btn vs-btn--force"
                      onClick={handleForce}
                      disabled={forcing}
                      title={`Push this schedule to all students in Group ${selGroup} Section ${selSection}`}
                    >
                      {forcing ? '⏳ Forcing…' : `🚀 Force on All Group ${selGroup} S${selSection} Students`}
                    </button>
                  )}
                </div>
              </div>

              {groupSlots.slots.length === 0 ? (
                <div className="vs-empty"><span>📭</span><h3>No slots for this group/section</h3><p>Make sure the master schedule has been generated.</p></div>
              ) : (
                <div className="vs-week">
                  {DAYS.filter(d => groupSlots.slots.some(s => s.day === d)).map(day => {
                    const daySlots = groupSlots.slots.filter(s => s.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
                    return (
                      <div key={day} className="vs-day-col">
                        <div className="vs-day-header">
                          <span className="vs-day-name">{day}</span>
                          <span className="vs-day-count">{daySlots.length}</span>
                        </div>
                        <div className="vs-day-slots">
                          {daySlots.map((slot, i) => {
                            const st = TYPE_STYLE[slot.type] || TYPE_STYLE.lecture;
                            return (
                              <div key={i} className="vs-slot"
                                style={{ background:st.bg, borderLeft:`4px solid ${st.color}`, border:`1px solid ${st.border}`, borderLeftWidth:4 }}>
                                <div className="vs-slot-time">{fmt(slot.startTime)}<span className="vs-sep">–</span>{fmt(slot.endTime)}</div>
                                <div className="vs-slot-body">
                                  <div className="vs-slot-course">
                                    <span className="vs-code">{slot.courseCode}</span>
                                    <span className="vs-name">{slot.courseName}</span>
                                  </div>
                                  <div className="vs-slot-pills">
                                    <span className="vs-pill" style={{ background:st.color+'22', color:st.color }}>{st.icon} {st.label}</span>
                                    <span className="vs-pill vs-pill--group">👥 Group {slot.group}</span>
                                    {slot.type !== 'lecture' && slot.section && (
                                      <span className="vs-pill vs-pill--section">§ Section {slot.section}</span>
                                    )}
                                    {slot.venue && <span className="vs-pill vs-pill--venue">{VENUE_ICON(slot.venue)} {slot.venue}</span>}
                                    {slot.staffName && (
                                      <span className="vs-pill vs-pill--staff">
                                        {slot.staffRole === 'doctor' ? '🎓' : '📋'} {slot.staffName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: STAFF / MY SCHEDULE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'mystaff' && (
        <div className="vs-group-tab">

          {/* ── Header ── */}
          <div className="vs-group-header">
            <div className="vs-group-title">
              <span>{user?.role === 'doctor' ? '🎓' : '📋'}</span>
              <h2>{isStaff ? `${user?.role === 'doctor' ? 'Dr.' : ''} ${user?.firstName || ''} ${user?.lastName || ''} — My Schedule` : 'Staff Schedules'}</h2>
              {staffSlots && <span className="vs-day-count">{staffSlots.totalSlots} slots</span>}
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              {staffSlots && staffSlots.totalSlots > 0 && (
                <>
                  <button className="vs-btn vs-btn--excel"
                    onClick={() => {
                      const name = staffSlots.staff ? `${staffSlots.staff.firstName}_${staffSlots.staff.lastName}` : 'Staff';
                      handleExport('excel', staffSlots.slots,
                        `${staffSlots.staff?.role === 'doctor' ? 'Dr.' : 'Ast.'} ${staffSlots.staff?.firstName || ''} ${staffSlots.staff?.lastName || ''} — Schedule`,
                        `${staffSlots.totalSlots} slots`,
                        `HNU_${name}_Schedule`);
                    }} disabled={!!exporting}>
                    {exporting?.type === 'excel' ? '⏳' : '📊'} Excel
                  </button>
                  <button className="vs-btn vs-btn--pdf"
                    onClick={() => {
                      const name = staffSlots.staff ? `${staffSlots.staff.firstName}_${staffSlots.staff.lastName}` : 'Staff';
                      handleExport('pdf', staffSlots.slots,
                        `${staffSlots.staff?.role === 'doctor' ? 'Dr.' : 'Ast.'} ${staffSlots.staff?.firstName || ''} ${staffSlots.staff?.lastName || ''} — Schedule`,
                        `${staffSlots.totalSlots} slots`,
                        `HNU_${name}_Schedule`);
                    }} disabled={!!exporting}>
                    {exporting?.type === 'pdf' ? '⏳' : '📄'} PDF
                  </button>
                </>
              )}
              <button className="vs-btn" onClick={() => isStaff ? loadStaffSchedule(null) : loadStaffSchedule(selStaffId)} disabled={sLoading}>
                {sLoading ? '⏳ Loading…' : '🔄 Refresh'}
              </button>
              {superAdmin && (
                <button className="vs-btn vs-btn--force" onClick={handleForceStaffAll} disabled={forcingStaff}
                  title="Save each staff member's slots into their personal Schedule doc">
                  {forcingStaff ? '⏳ Pushing…' : '🚀 Push All Staff Schedules'}
                </button>
              )}
            </div>
          </div>

          {/* ── Admin: staff picker ── */}
          {superAdmin && (
            <div className="vs-group-picker">
              <div className="vs-filter-group" style={{flex:1, minWidth:240}}>
                <label>Select Staff Member</label>
                <select value={selStaffId} onChange={e => setSelStaffId(e.target.value)}>
                  {staffList.length === 0 && <option value="">Loading staff…</option>}
                  {staffList.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.role === 'doctor' ? 'Dr.' : 'Ast.'} {s.name} — {s.slotCount} slot{s.slotCount !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {staffSlots?.staff && (
                <div className="vs-filter-group">
                  <label>Role</label>
                  <span style={{padding:'8px 12px', fontSize:13, fontWeight:700, color:'#6366f1'}}>
                    {staffSlots.staff.role === 'doctor' ? '🎓 Doctor' : '📋 Assistant'}
                  </span>
                </div>
              )}
            </div>
          )}

          {sError  && <div className="vs-alert vs-alert--err">{sError}</div>}
          {forceStaffRes && (
            <div className="vs-force-result">
              ✅ Personal schedule pushed to <strong>{forceStaffRes.pushed}</strong> staff member(s).
            </div>
          )}

          {sLoading && <div className="vs-loader"><div className="vs-spinner"/><p>Loading schedule…</p></div>}

          {!sLoading && staffSlots && staffSlots.totalSlots === 0 && (
            <div className="vs-empty">
              <span>📭</span>
              <h3>No slots assigned</h3>
              <p>This staff member has no slots in the current master schedule.</p>
            </div>
          )}

          {!sLoading && staffSlots && staffSlots.totalSlots > 0 && (() => {
            const byD = groupByDay(staffSlots.slots);
            return (
              <div className="vs-week">
                {DAYS.filter(d => byD[d]?.length > 0).map(day => (
                  <div key={day} className="vs-day-col">
                    <div className="vs-day-header">
                      <span className="vs-day-name">{day}</span>
                      <span className="vs-day-count">{byD[day].length}</span>
                    </div>
                    <div className="vs-day-slots">
                      {byD[day].sort((a,b) => a.startTime.localeCompare(b.startTime)).map((slot, i) => {
                        const st = TYPE_STYLE[slot.type] || TYPE_STYLE.lecture;
                        return (
                          <div key={i} className="vs-slot vs-slot--mine"
                            style={{ background:st.bg, borderLeft:`4px solid ${st.color}`, border:`1px solid ${st.border}`, borderLeftWidth:4 }}>
                            <div className="vs-slot-time">{fmt(slot.startTime)}<span className="vs-sep">–</span>{fmt(slot.endTime)}</div>
                            <div className="vs-slot-body">
                              <div className="vs-slot-course">
                                <span className="vs-code">{slot.courseCode}</span>
                                <span className="vs-name">{slot.courseName}</span>
                              </div>
                              <div className="vs-slot-pills">
                                <span className="vs-pill" style={{ background:st.color+'22', color:st.color }}>{st.icon} {st.label}</span>
                                {slot.group && <span className="vs-pill vs-pill--group">👥 Group {slot.group}</span>}
                                {slot.type !== 'lecture' && slot.section && (
                                  <span className="vs-pill vs-pill--section">§ Section {slot.section}</span>
                                )}
                                {slot.venue && <span className="vs-pill vs-pill--venue">{VENUE_ICON(slot.venue)} {slot.venue}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: VENUE AVAILABILITY
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'venues' && (
        <div className="vs-venues-tab">
          {/* Venue filter bar */}
          <div className="vs-filters">
            <div className="vs-filter-group">
              <label>Venue Type</label>
              <select value={venueType} onChange={e => setVenueType(e.target.value)}>
                <option value="All">All venues</option>
                <option value="amphitheatre">🏛️ Amphitheatres</option>
                <option value="lab">🔬 Labs</option>
                <option value="room">🚪 Rooms</option>
              </select>
            </div>
            <div className="vs-filter-group">
              <label>Day</label>
              <select value={venueDay} onChange={e => setVenueDay(e.target.value)}>
                <option value="All">All days</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="vs-filter-group" style={{justifyContent:'flex-end'}}>
              <label>&nbsp;</label>
              <button className={`vs-btn ${freeOnly ? 'vs-btn--active' : ''}`} onClick={() => setFreeOnly(v=>!v)}>
                {freeOnly ? '✅ Free Only' : '✅ Show Free Only'}
              </button>
            </div>
          </div>

          {vLoading ? (
            <div className="vs-loader"><div className="vs-spinner"/><p>Loading venues…</p></div>
          ) : filteredVenues.length === 0 ? (
            <div className="vs-empty"><span>🏛️</span><h3>No venues found</h3></div>
          ) : (
            <div className="vs-venues-grid">
              {filteredVenues.map(venue => {
                const vc = VENUE_COLOR(venue.type);
                return (
                  <div key={venue.name} className="vs-venue-card">
                    <div className="vs-venue-header" style={{ borderLeft:`4px solid ${vc.color}`, background: vc.bg }}>
                      <span className="vs-venue-icon">{VENUE_ICON(venue.name)}</span>
                      <span className="vs-venue-name">{venue.name}</span>
                      <span className="vs-venue-type-badge" style={{ color: vc.color, background: vc.color+'22' }}>
                        {venue.type}
                      </span>
                    </div>
                    <div className="vs-venue-days">
                      {daysToShow.map(day => {
                        const slots = venue.days[day] || [];
                        const displaySlots = freeOnly ? slots.filter(s => s.free) : slots;
                        if (displaySlots.length === 0) return null;
                        return (
                          <div key={day} className="vs-venue-day">
                            <div className="vs-venue-day-label">{day}</div>
                            <div className="vs-venue-slots">
                              {displaySlots.map((s, i) => (
                                <div key={i} className={`vs-venue-slot ${s.free ? 'vs-venue-slot--free' : 'vs-venue-slot--busy'}`}>
                                  <span className="vs-venue-slot-time">{fmt(s.start)} – {fmt(s.end)}</span>
                                  {s.free
                                    ? <span className="vs-venue-slot-status">✅ Free</span>
                                    : <span className="vs-venue-slot-status vs-venue-slot-status--busy">
                                        🔒 {s.courseCode} · {s.type}
                                      </span>
                                  }
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewSchedule;

















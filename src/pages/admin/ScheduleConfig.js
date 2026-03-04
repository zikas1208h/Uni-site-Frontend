import React, { useState, useEffect, useCallback } from 'react';
import { scheduleAPI, courseAPI, staffAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './ScheduleConfig.css';

const DAYS_ALL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ROOM_TYPES = ['room','amphitheatre','lab'];

const defaultConfig = {
  workingDays: ['Sunday','Monday','Tuesday','Wednesday','Thursday'],
  dayStartTime: '08:00', dayEndTime: '18:00',
  breakBetweenSlots: 0,
  lectureDuration: 120, sectionDuration: 120, labDuration: 120,
  maxLecturesPerDay: 2, maxSectionsPerDay: 5, maxSlotsPerStudentPerDay: 5,
  rooms: [], semester: 'Spring', year: 2026,
};

const ScheduleConfig = () => {
  const { t } = useLanguage();
  const [config, setConfig]         = useState(defaultConfig);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMaster, setGenMaster]   = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [warnings, setWarnings]     = useState([]);
  const [newRoom, setNewRoom]       = useState({ name: '', type: 'room', capacity: 40 });

  // Targeted generation filter
  const [filterYear,     setFilterYear]     = useState('2');
  const [filterSemester, setFilterSemester] = useState('Spring');
  const [genFiltered,    setGenFiltered]    = useState(false);

  // Course-staff assignment
  const [courses,    setCourses]    = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allAssts,   setAllAssts]   = useState([]);
  const [staffTab,   setStaffTab]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [cfgRes, courseRes, staffRes] = await Promise.all([
        scheduleAPI.getConfig().catch(() => ({ data: defaultConfig })),
        courseAPI.getAllCourses().catch(() => ({ data: [] })),
        staffAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setConfig(cfgRes.data || defaultConfig);

      // Load course-staff assignments
      const csRes = await scheduleAPI.getCourseStaff().catch(() => ({ data: [] }));
      // Merge scheduleDoctors / scheduleAssistants into courses list
      const csMap = {};
      (csRes.data || []).forEach(c => { csMap[c._id] = c; });
      const merged = (courseRes.data || []).map(c => ({
        ...c,
        scheduleDoctors:    csMap[c._id]?.scheduleDoctors    || [],
        scheduleAssistants: csMap[c._id]?.scheduleAssistants || [],
      }));
      setCourses(merged);

      const staffList = staffRes.data?.data || staffRes.data || [];
      setAllDoctors(staffList.filter(s => s.role === 'doctor' || s.role === 'superadmin'));
      setAllAssts(staffList.filter(s => s.role === 'assistant'));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k, v) => setConfig(p => ({ ...p, [k]: v }));
  const toggleDay = (d) => {
    const curr = config.workingDays || [];
    setField('workingDays', curr.includes(d) ? curr.filter(x => x !== d) : [...curr, d]);
  };
  const addRoom = () => {
    if (!newRoom.name.trim()) return;
    setConfig(p => ({ ...p, rooms: [...(p.rooms||[]), { ...newRoom }] }));
    setNewRoom({ name: '', type: 'room', capacity: 40 });
  };
  const removeRoom = (i) => setConfig(p => ({ ...p, rooms: p.rooms.filter((_,idx) => idx !== i) }));
  const updateRoom = (i,k,v) => setConfig(p => {
    const rooms = [...p.rooms]; rooms[i] = { ...rooms[i], [k]: k==='capacity'?Number(v):v };
    return { ...p, rooms };
  });

  // Toggle a doctor/assistant for a course
  const toggleCourseStaff = async (courseId, staffId, type, currentList) => {
    const ids = currentList.map(s => s._id || s);
    const next = ids.includes(staffId) ? ids.filter(id => id !== staffId) : [...ids, staffId];
    const update = type === 'doctor' ? { doctors: next } : { assistants: next };
    try {
      const res = await scheduleAPI.setCourseStaff(courseId, update);
      setCourses(prev => prev.map(c => c._id === courseId ? {
        ...c,
        scheduleDoctors:    res.data.scheduleDoctors    || c.scheduleDoctors,
        scheduleAssistants: res.data.scheduleAssistants || c.scheduleAssistants,
      } : c));
    } catch(e) { setError('Failed to update course staff: ' + (e.response?.data?.message || e.message)); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try { await scheduleAPI.saveConfig(config); setSuccess('✅ Configuration saved!'); }
    catch(e) { setError(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleGenerateMaster = async () => {
    if (!window.confirm('Generate the master schedule from ALL courses with staff assigned?')) return;
    setGenMaster(true); setError(''); setSuccess(''); setWarnings([]);
    try {
      const r = await scheduleAPI.generateMaster({});
      setSuccess(`✅ ${r.data.message}`);
      if (r.data.warnings?.length) setWarnings(r.data.warnings);
    } catch(e) { setError(e.response?.data?.message || 'Failed to generate master schedule'); }
    finally { setGenMaster(false); }
  };

  const handleGenerateFiltered = async () => {
    const semLabel = filterSemester || 'any semester';
    const yrLabel  = filterYear     ? `Year ${filterYear}` : 'all years';
    if (!window.confirm(
      `Generate schedule for ${yrLabel} · ${semLabel} — only active courses with staff assigned?`
    )) return;
    setGenFiltered(true); setError(''); setSuccess(''); setWarnings([]);
    try {
      const params = {};
      if (filterYear)     params.filterYear     = Number(filterYear);
      if (filterSemester) params.filterSemester = filterSemester;
      const r = await scheduleAPI.generateMaster(params);
      setSuccess(`✅ ${r.data.message}`);
      if (r.data.warnings?.length) setWarnings(r.data.warnings);
    } catch(e) { setError(e.response?.data?.message || 'Failed to generate'); }
    finally { setGenFiltered(false); }
  };

  const handleGenerateAll = async () => {
    if (!window.confirm('Regenerate schedules for ALL students from master?')) return;
    setGenerating(true); setError(''); setSuccess('');
    try { const r = await scheduleAPI.generateAll(); setSuccess(`✅ ${r.data.message}`); }
    catch(e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setGenerating(false); }
  };

  if (loading) return <div className="sc-page"><div className="sc-loader"><div className="sc-spinner"/><p>Loading…</p></div></div>;

  return (
    <div className="sc-page">
      <div className="sc-header">
        <div>
          <h1>📅 Schedule Configuration</h1>
          <p>Set rooms, assign staff to courses, then generate the master schedule.</p>
        </div>
      <div className="sc-header-actions">
          {/* ── Targeted generation panel ── */}
          <div className="sc-gen-filter">
            <span className="sc-gen-filter-label">Generate for:</span>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="sc-gen-select"
              title="Academic year"
            >
              <option value="">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
            <select
              value={filterSemester}
              onChange={e => setFilterSemester(e.target.value)}
              className="sc-gen-select"
              title="Semester"
            >
              <option value="">All semesters</option>
              <option value="Fall">Fall (Term 1/3/5/7)</option>
              <option value="Spring">Spring (Term 2/4/6/8)</option>
              <option value="Summer">Summer</option>
            </select>
            <button
              className="sc-btn sc-btn--gold"
              onClick={handleGenerateFiltered}
              disabled={genFiltered}
              title="Generate master schedule only for active courses in the selected year/semester"
            >
              {genFiltered ? '⏳ Generating…' : '🗓️ Generate Schedule'}
            </button>
          </div>

          {/* ── Full generation & push ── */}
          <button className="sc-btn sc-btn--outline" onClick={handleGenerateMaster} disabled={genMaster}
            title="Generate master schedule from ALL courses with staff (no filter)">
            {genMaster ? '⏳ …' : '🗓️ Generate All Courses'}
          </button>
          <button className="sc-btn sc-btn--secondary" onClick={handleGenerateAll} disabled={generating}>
            {generating ? '⏳ …' : '⚡ Push to All Students'}
          </button>
          <button className="sc-btn sc-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Config'}
          </button>
        </div>
      </div>

      {error   && <div className="sc-alert sc-alert--err">{error}</div>}
      {success && <div className="sc-alert sc-alert--ok">{success}</div>}
      {warnings.length > 0 && (
        <div className="sc-alert sc-alert--warn">
          <strong>⚠️ {warnings.length} warning(s):</strong>
          <ul style={{margin:'6px 0 0 16px'}}>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {/* Tab switcher */}
      <div className="sc-tabs">
        <button className={`sc-tab ${!staffTab?'active':''}`} onClick={()=>setStaffTab(false)}>⚙️ Config & Rooms</button>
        <button className={`sc-tab ${staffTab?'active':''}`}  onClick={()=>setStaffTab(true)}>👩‍🏫 Course Staff Assignment</button>
      </div>

      {!staffTab ? (
        <div className="sc-grid">
          {/* Semester */}
          <div className="sc-card">
            <h2>📆 Semester</h2>
            <div className="sc-row">
              <div className="sc-field"><label>Semester</label>
                <select value={config.semester} onChange={e=>setField('semester',e.target.value)}>
                  <option>Fall</option><option>Spring</option><option>Summer</option>
                </select>
              </div>
              <div className="sc-field"><label>Year</label>
                <input type="number" min="2020" max="2035" value={config.year} onChange={e=>setField('year',Number(e.target.value))}/>
              </div>
            </div>
          </div>

          {/* Working Days */}
          <div className="sc-card">
            <h2>📅 Working Days</h2>
            <div className="sc-days">
              {DAYS_ALL.map(d=>(
                <button key={d} className={`sc-day-btn ${(config.workingDays||[]).includes(d)?'active':''}`} onClick={()=>toggleDay(d)}>
                  {d.slice(0,3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time window — fixed per requirements */}
          <div className="sc-card">
            <h2>⏰ Daily Time Window</h2>
            <p className="sc-card-hint">Fixed: 08:00 – 18:00 · 5 slots/day × 2 h each</p>
            <div className="sc-row">
              <div className="sc-field"><label>Start</label>
                <input type="time" value={config.dayStartTime} onChange={e=>setField('dayStartTime',e.target.value)}/>
              </div>
              <div className="sc-field"><label>End</label>
                <input type="time" value={config.dayEndTime}   onChange={e=>setField('dayEndTime',e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Rooms */}
          <div className="sc-card sc-card--full">
            <h2>🏫 Venues</h2>
            <p className="sc-card-hint">Default: 4 amphitheatres (lectures), 8 labs + 2 rooms (sections). Override here if needed.</p>
            <div className="sc-add-room">
              <input placeholder="Name (e.g. Amphitheatre A)" value={newRoom.name}
                onChange={e=>setNewRoom(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addRoom()}/>
              <select value={newRoom.type} onChange={e=>setNewRoom(p=>({...p,type:e.target.value}))}>
                {ROOM_TYPES.map(rt=><option key={rt} value={rt}>{rt.charAt(0).toUpperCase()+rt.slice(1)}</option>)}
              </select>
              <input type="number" placeholder="Capacity" min="1" max="2000" value={newRoom.capacity}
                onChange={e=>setNewRoom(p=>({...p,capacity:Number(e.target.value)}))} style={{width:90}}/>
              <button className="sc-btn sc-btn--primary" onClick={addRoom}>+ Add</button>
            </div>
            {(config.rooms||[]).length===0 ? (
              <div className="sc-rooms-empty">Using default venues (4 amphitheatres, 8 labs, 2 rooms).</div>
            ) : (
              <div className="sc-rooms-list">
                <div className="sc-rooms-thead"><span>Name</span><span>Type</span><span>Capacity</span><span/></div>
                {config.rooms.map((r,i)=>(
                  <div key={i} className="sc-rooms-row">
                    <input value={r.name} onChange={e=>updateRoom(i,'name',e.target.value)}/>
                    <select value={r.type} onChange={e=>updateRoom(i,'type',e.target.value)}>
                      {ROOM_TYPES.map(rt=><option key={rt} value={rt}>{rt.charAt(0).toUpperCase()+rt.slice(1)}</option>)}
                    </select>
                    <input type="number" value={r.capacity} min="1" onChange={e=>updateRoom(i,'capacity',e.target.value)}/>
                    <button className="sc-btn-del" onClick={()=>removeRoom(i)}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Course Staff Assignment Tab ── */
        <div className="sc-staff-tab">
          <p className="sc-card-hint" style={{marginBottom:12}}>
            For each course: assign <strong>1–2 doctors</strong> (lectures, max 2 days/week) and
            <strong> ≥1 assistant</strong> (sections for all 6 groups × 2 sections, max 3 days/week, 5 sections/day).
            Courses with no staff are skipped during generation.
          </p>

          {/* Staff-tab filter bar */}
          <div className="sc-staff-filter-bar">
            <span className="sc-gen-filter-label">Show courses for:</span>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="sc-gen-select"
            >
              <option value="">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
            <select
              value={filterSemester}
              onChange={e => setFilterSemester(e.target.value)}
              className="sc-gen-select"
            >
              <option value="">All semesters</option>
              <option value="Fall">Fall</option>
              <option value="Spring">Spring</option>
              <option value="Summer">Summer</option>
            </select>
            <span className="sc-staff-count">
              {courses.filter(c =>
                (!filterYear     || String(c.year)    === String(filterYear)) &&
                (!filterSemester || c.semester === filterSemester)
              ).length} course(s)
            </span>
          </div>

          {courses.length === 0 ? (
            <div className="sc-rooms-empty">No courses found.</div>
          ) : courses
              .filter(c =>
                (!filterYear     || String(c.year)    === String(filterYear)) &&
                (!filterSemester || c.semester === filterSemester)
              )
              .map(course => (
            <div key={course._id} className="sc-course-card">
              <div className="sc-course-header">
                <span className="sc-course-code">{course.courseCode}</span>
                <span className="sc-course-name">{course.courseName}</span>
                <span className="sc-course-meta">
                  <span className="sc-badge sc-badge--info">Y{course.year} · {course.semester}</span>
                  {course.status === 'completed' && <span className="sc-badge sc-badge--gray">Completed</span>}
                  {course.status !== 'completed' && <span className="sc-badge sc-badge--green">Active</span>}
                </span>
                <span className="sc-course-badges">
                  <span className={`sc-badge ${course.scheduleDoctors?.length?'sc-badge--ok':'sc-badge--warn'}`}>
                    🎓 {course.scheduleDoctors?.length||0} doctor{course.scheduleDoctors?.length!==1?'s':''}
                  </span>
                  <span className={`sc-badge ${course.scheduleAssistants?.length?'sc-badge--ok':'sc-badge--warn'}`}>
                    📋 {course.scheduleAssistants?.length||0} assistant{course.scheduleAssistants?.length!==1?'s':''}
                  </span>
                </span>
              </div>
              <div className="sc-course-body">
                <div className="sc-staff-col">
                  <p className="sc-staff-col-label">Doctors (max 2)</p>
                  <div className="sc-staff-pills">
                    {allDoctors.map(d => {
                      const active = (course.scheduleDoctors||[]).some(s=>(s._id||s)===d._id||(s._id||s)===d._id?.toString()||(s._id||s).toString()===d._id?.toString());
                      const atMax  = (course.scheduleDoctors||[]).length >= 2 && !active;
                      return (
                        <button key={d._id}
                          className={`sc-pill ${active?'sc-pill--active':''} ${atMax?'sc-pill--disabled':''}`}
                          onClick={()=>!atMax&&toggleCourseStaff(course._id, d._id, 'doctor', course.scheduleDoctors||[])}
                          disabled={atMax}>
                          Dr. {d.firstName} {d.lastName}
                        </button>
                      );
                    })}
                    {allDoctors.length===0&&<span className="sc-empty-pill">No doctors in system</span>}
                  </div>
                </div>
                <div className="sc-staff-col">
                  <p className="sc-staff-col-label">Assistants (≥1)</p>
                  <div className="sc-staff-pills">
                    {allAssts.map(a => {
                      const active = (course.scheduleAssistants||[]).some(s=>(s._id||s).toString()===a._id?.toString());
                      return (
                        <button key={a._id}
                          className={`sc-pill ${active?'sc-pill--active':''}`}
                          onClick={()=>toggleCourseStaff(course._id, a._id, 'assistant', course.scheduleAssistants||[])}
                        >
                          {a.firstName} {a.lastName}
                        </button>
                      );
                    })}
                    {allAssts.length===0&&<span className="sc-empty-pill">No assistants in system</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {config.version && (
        <p className="sc-version">Config v{config.version} · {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : ''}</p>
      )}
    </div>
  );
};

export default ScheduleConfig;


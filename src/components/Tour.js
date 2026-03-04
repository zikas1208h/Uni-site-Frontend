/**
 * HNU Portal — Guided Interactive Tour
 * Navigates to pages, highlights real elements with a pulse ring,
 * positions tooltip near the target, short action-oriented text.
 */
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isSuperAdmin, isDoctor, isAssistant } from '../context/AuthContext';
import './Tour.css';

/**
 * selector : CSS selector of element to highlight (null = center modal)
 * title    : short title
 * action   : 1–2 line instruction ("👆 See these 4 cards — they update live")
 * navTo    : navigate here first
 * placement: 'bottom'|'top'|'left'|'right'|'center'
 */
const s = (selector, title, action, navTo = null, placement = 'bottom') =>
  ({ selector, title, action, navTo, placement });

// ── STUDENT ────────────────────────────────────────────────────────────────
const STUDENT_STEPS = [
  s(null, '👋 Welcome to HNU Portal!',
    'This tour takes you through every page and shows you exactly what to do.\n\nClick Next → and we\'ll go page by page.',
    '/dashboard', 'center'),

  s('.navbar-logo', '🏠 This is your Home button',
    'Click the HNU logo anytime to return to your Dashboard from any page.',
    null, 'bottom'),

  s('[data-tour="nav-courses"]', '📚 Courses link',
    'Click here to browse all courses, check prerequisites, and enroll.',
    null, 'bottom'),

  s('[data-tour="nav-assignments"]', '📝 Assignments link',
    'All your assignment deadlines and submissions live here.',
    null, 'bottom'),

  s('[data-tour="nav-schedule"]', '📅 Schedule link',
    'Your personal weekly timetable — lectures and sections.',
    null, 'bottom'),

  s('[data-tour="nav-materials"]', '📄 Materials link',
    'Download files uploaded by your doctors and assistants.',
    null, 'bottom'),

  s('[data-tour="nav-grades"]', '📊 Grades link',
    'Your full transcript — every grade, every semester, with GPA.',
    null, 'bottom'),

  s('.btn-tour-help', '❓ This button replays the tour',
    'Click ❓ anytime to restart this tour from any page.',
    null, 'bottom'),

  s('.stats-grid', '📊 Your 4 live stat cards',
    '👆 These update automatically:\n• CGPA out of 4.0  • Credits earned\n• Enrolled this semester  • Completed courses',
    '/dashboard', 'bottom'),

  s('.gpa-card', '🎯 Your CGPA',
    'This is your most important number.\nIt recalculates every time a grade is added or changed.',
    null, 'right'),

  s('.credit-eligibility-card', '📋 How many more credits can you add?',
    'Shows your limit, what you\'re in, and how many slots remain.\n0 remaining = you\'ve hit your semester limit.',
    null, 'left'),

  s('.dashboard-sections', '📰 Recent activity',
    '👆 Scroll down here to see:\n• Last 5 materials uploaded\n• Your current courses\n• Your last 5 grades',
    null, 'top'),

  s('.courses-page', '📚 Browse all your courses here',
    '👆 This is the Courses page.\nAll courses for your major and year are shown here.',
    '/courses', 'bottom'),

  s('.courses-page input, .courses-page .search-input, input[placeholder*="earch"]', '🔍 Type here to search',
    'Type a course code (e.g. COM207) or name.\nThe list filters instantly as you type.',
    null, 'bottom'),

  s('.course-card', '📖 This is a course card',
    'Each card shows: code, name, credits, prerequisites.\n👆 Click Enroll → system checks prerequisites → registers you immediately.',
    null, 'right'),

  s('.assignments-page', '📝 All your assignments in one place',
    '👆 Sorted by deadline — soonest at the top.\nAll courses combined.',
    '/assignments', 'bottom'),

  s('.asgn-card', '📋 Click a card to expand it',
    '👆 Shows: deadline countdown ⏰, type, and your status.\nExpand → choose file → Upload to submit.',
    null, 'top'),

  s('.asgn-filters', '🔍 Filter your assignments',
    'Search by name, filter by course, or tab:\nAll · Pending · Submitted · Reviewed · Graded',
    null, 'bottom'),

  s('.sched-page', '📅 Your personal timetable',
    '👆 Built for YOUR group and section.\nSwitching between Week view 📆 and List view 📋.',
    '/schedule', 'bottom'),

  s('.sched-slot', '🗓️ This is a schedule slot',
    'Shows: course, Lecture or Section, venue, exact time, and staff name.\n📊 Export Excel  📄 Export PDF — buttons at the top.',
    null, 'top'),

  s('.view-materials', '📄 Files grouped by course',
    '👆 Click any course group to expand it.\nThen click 📥 Download on any file.',
    '/materials', 'bottom'),

  s('.vm-filters', '🔍 Filter materials',
    'Search by title or filter by course and type\n(Lecture / Section / Video / Extra).',
    null, 'bottom'),

  s('.grade-statistics', '📊 Your full transcript',
    '👆 Every grade grouped by semester.\nShows letter grade, credits, semester GPA, and running CGPA.',
    '/grades', 'bottom'),

  s('.navbar-profile', '👤 Your profile',
    'Click your name here to:\n• Edit your info  • Upload a photo\n• Change password via OTP email',
    null, 'bottom'),

  s(null, '🎉 Tour complete!',
    'You\'ve seen every page!\n\n• Dashboard  • Courses  • Assignments\n• Schedule  • Materials  • Grades  • Profile\n\nPress ❓ anytime to replay.',
    null, 'center'),
];

// ── SUPERADMIN ─────────────────────────────────────────────────────────────
const SUPERADMIN_STEPS = [
  s(null, '👑 Welcome, Super Admin!',
    'This tour visits every admin page and shows you exactly what each tool does.\n\nClick Next → to begin.',
    '/admin/dashboard', 'center'),

  s('[data-tour="nav-students"]', '👨‍🎓 Students',
    'Click here to view and manage every student in the university.',
    null, 'bottom'),

  s('[data-tour="nav-grades"]', '📝 Manage Grades',
    'Grade any student using 3 different methods.',
    null, 'bottom'),

  s('[data-tour="nav-schedule"]', '📅 Master Schedule',
    'The full university timetable for all groups.',
    null, 'bottom'),

  s('[data-tour="nav-more"]', '⚙️ More tools — click this',
    '👆 Opens: Schedule Config · Create Course · Upload Material\nGrade Statistics · Registration · Import · Staff',
    null, 'bottom'),

  s('.stats-grid, .admin-stats', '📊 Live university stats',
    '👆 These update in real time:\n• Students · Active courses · Enrollments\n• Materials · Doctors · Assistants',
    '/admin/dashboard', 'top'),

  s('.quick-actions, .admin-actions', '⚡ Quick action shortcuts',
    '👆 One click to the most common tasks:\nAdd Student · Create Course · Upload Material · Generate Schedule · Manage Staff',
    null, 'top'),

  s('.view-students', '👨‍🎓 Every student is listed here',
    '👆 Search by name, ID, or email.\nFilter by major, year, group, section.',
    '/admin/view-students', 'bottom'),

  s('.student-card', '👤 Click any student card',
    '→ Opens full profile: info, enrolled courses, grades, schedule.\n→ Export as PDF or Excel.',
    null, 'top'),

  s('.manage-grades', '📝 Find a student to grade',
    '👆 Type a name or ID in the search box.\nClick their name → select a course → choose grading method.',
    '/admin/manage-grades', 'bottom'),

  s('.grading-panel, .grade-form, .mg-methods, .method-tabs', '3 grading methods',
    'Method 1 — Score Based: quiz + assignment + final → auto letter grade\nMethod 2 — Manual: pick A+, A, B+... directly\nMethod 3 — Custom weights: define your own percentages',
    null, 'top'),

  s('.sc-page', '⚙️ Schedule Configuration',
    '👆 This is where you build the timetable.\nTwo tabs: Config & Rooms · Course Staff Assignment',
    '/admin/schedule-config', 'bottom'),

  s('.sc-tabs', '📋 Switch between tabs here',
    'Tab 1: set available rooms and labs.\nTab 2: assign doctors and assistants to each course.',
    null, 'top'),

  s('.sc-header-actions', '🚀 Click Generate to build the schedule',
    'Algorithm places lectures in Amphitheatres 1-4,\nsections in Labs 1-8 and Rooms A5/A6, zero conflicts.',
    null, 'bottom'),

  s('.vs-page', '📅 The master schedule',
    '👆 Every group\'s lectures and sections.\nToggle Week/List, filter My Slots Only, export PDF/Excel.',
    '/admin/schedule', 'bottom'),

  s('.vs-slot', '📌 This is a schedule slot',
    'Shows: course, type (Lecture/Section), group, venue, staff name.\n🗑️ Delete Schedule button is at the top (super admin only).',
    null, 'top'),

  s('.create-course', '➕ Create a new course',
    '👆 Fill in code, name, credits, major, year, prerequisites.\nToggle Active ON → students can see and enroll.',
    '/admin/create-course', 'right'),

  s('.upload-material', '📤 Upload a file for students',
    '👆 Select course, enter title, pick type (Lecture/Section/Video/Extra).\nChoose file (max 50MB) → Upload → students download immediately.',
    '/admin/upload-material', 'right'),

  s('.grade-statistics', '📈 University-wide grade analytics',
    '👆 Live: total graded, avg GPA, pass rate, distribution chart.\nExport PDF or Excel report with the buttons above.',
    '/admin/grade-statistics', 'bottom'),

  s('.ms-page', '👥 Add and manage staff',
    '👆 Click "+ Add Staff Member" to create a doctor or assistant.\nFirst login forces them to set a password via OTP.',
    '/admin/staff', 'bottom'),

  s('.registration-periods, .reg-page, .rp-container', '🗓️ Control when students can enroll',
    '👆 No active period = nobody can enroll.\nCreate a period, set dates, toggle Open/Closed anytime.',
    '/admin/registration', 'bottom'),

  s('.import-page', '📥 Import hundreds of grades at once',
    '👆 Drop an Excel (.xlsx) or PDF file here.\nPreview detects all rows — red = invalid.\nClick Confirm Import to save.',
    '/admin/import-pdf', 'bottom'),

  s(null, '🎉 Admin Tour Complete!',
    'You\'ve seen everything!\n\n• Dashboard · Students · Grades · Schedule Config\n• View Schedule · Create Course · Upload Material\n• Statistics · Staff · Registration · Import\n\nPress ❓ anytime to replay.',
    null, 'center'),
];

// ── DOCTOR ─────────────────────────────────────────────────────────────────
const DOCTOR_STEPS = [
  s(null, '🎓 Welcome, Doctor!',
    'This tour shows you every feature available to you.\n\nClick Next → to begin.',
    '/admin/dashboard', 'center'),

  s('[data-tour="nav-students"]', '👨‍🎓 Your students',
    'Only students in YOUR courses. Click to view, grade, or export.',
    null, 'bottom'),

  s('[data-tour="nav-grades"]', '📝 Grade your students',
    'Click here to find a student and add or update a grade.',
    null, 'bottom'),

  s('[data-tour="nav-schedule"]', '📅 Your lecture schedule',
    'Shows only your slots — courses, groups, amphitheatres, times.',
    null, 'bottom'),

  s('[data-tour="nav-more"]', '📋 More tools',
    '👆 Opens: Assignments · Statistics · Upload Material · Import',
    null, 'bottom'),

  s('.stats-grid, .admin-stats', '📊 Your teaching overview',
    '👆 Assigned courses · Total students · Materials you uploaded.',
    '/admin/dashboard', 'top'),

  s('.student-card', '👤 Click any student to open their profile',
    '→ Grades, enrolled courses, personal schedule.\n→ Export as PDF or Excel.',
    '/admin/view-students', 'top'),

  s('.manage-grades', '🔍 Search here to grade a student',
    '👆 Type name or ID → click their name → select course → grade.',
    '/admin/manage-grades', 'bottom'),

  s('.vs-page', '📅 Only your lecture slots',
    '👆 Each slot: course, group, amphitheatre, day, time.\nMax 2 days/week. Export PDF or Excel.',
    '/admin/schedule', 'bottom'),

  s('.ma-header, .manage-assignments-page', '📝 Create and review assignments',
    '👆 Click "+ New Assignment" to create one.\nAfter deadline: view submissions, add marks, download .zip.',
    '/admin/assignments', 'bottom'),

  s('.upload-material', '📤 Upload a file for your students',
    '👆 Select course → title → type → file → Upload.\nStudents download immediately.',
    '/admin/upload-material', 'right'),

  s('.grade-statistics', '📈 Grade analytics for your courses',
    '👆 Distribution, avg GPA, pass rate.\nExport PDF or Excel.',
    '/admin/grade-statistics', 'bottom'),

  s(null, '🎉 Doctor Tour Complete!',
    '• Dashboard · Students · Grades\n• Schedule · Assignments · Materials · Statistics\n\nPress ❓ anytime to replay.',
    null, 'center'),
];

// ── ASSISTANT ──────────────────────────────────────────────────────────────
const ASSISTANT_STEPS = [
  s(null, '📋 Welcome, Assistant!',
    'This tour shows you every feature available to you.\n\nClick Next → to begin.',
    '/admin/dashboard', 'center'),

  s('[data-tour="nav-students"]', '👨‍🎓 Your students',
    'Students in your assigned courses. Click to view their profile.',
    null, 'bottom'),

  s('[data-tour="nav-schedule"]', '📅 Your section schedule',
    'Shows only your section slots — labs, rooms, groups, times.',
    null, 'bottom'),

  s('[data-tour="nav-more"]', '📋 More tools',
    '👆 Opens: Assignments · Upload Material',
    null, 'bottom'),

  s('.stats-grid, .admin-stats', '📊 Your section overview',
    '👆 Assigned courses · Students in your sections · Materials uploaded.',
    '/admin/dashboard', 'top'),

  s('.vs-page', '📅 Only your section slots',
    '👆 Course, group, section number, lab/room, day, time.\nMax 3 days/week, 5 sections/day. Export PDF or Excel.',
    '/admin/schedule', 'bottom'),

  s('.view-materials', '📄 Files for your courses',
    '👆 Grouped by course. Click to expand → 📥 Download.',
    '/admin/view-materials', 'bottom'),

  s('.upload-material', '📤 Upload a file for your students',
    '👆 Course → title → type → file → Upload.\nStudents download immediately.',
    '/admin/upload-material', 'right'),

  s('.ma-header, .manage-assignments-page', '📝 Create section assignments',
    '👆 "+ New Assignment" to create.\nAfter deadline: view files, add marks, download .zip.',
    '/admin/assignments', 'bottom'),

  s('.manage-grades', '📝 Grade a student',
    '👆 Search name or ID → select course → Score Based or Manual → Save.\nCGPA updates immediately.',
    '/admin/manage-grades', 'bottom'),

  s(null, '🎉 Assistant Tour Complete!',
    '• Dashboard · Students · Schedule\n• Materials · Upload · Assignments · Grades\n\nPress ❓ anytime to replay.',
    null, 'center'),
];

const ROLE_STEPS = { student: STUDENT_STEPS, superadmin: SUPERADMIN_STEPS, doctor: DOCTOR_STEPS, assistant: ASSISTANT_STEPS };

// ─────────────────────────────────────────────────────────────────────────────
// TOUR ENGINE — positions tooltip near the highlighted element
// ─────────────────────────────────────────────────────────────────────────────
const TOOLTIP_W = 340;
const TOOLTIP_H = 220; // estimated
const GAP = 14;

function getPosition(el, placement) {
  if (!el) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top, left;
  if (placement === 'bottom') {
    top  = r.bottom + GAP;
    left = Math.min(Math.max(r.left + r.width / 2 - TOOLTIP_W / 2, 8), vw - TOOLTIP_W - 8);
  } else if (placement === 'top') {
    top  = r.top - TOOLTIP_H - GAP;
    left = Math.min(Math.max(r.left + r.width / 2 - TOOLTIP_W / 2, 8), vw - TOOLTIP_W - 8);
  } else if (placement === 'right') {
    top  = Math.min(Math.max(r.top + r.height / 2 - TOOLTIP_H / 2, 8), vh - TOOLTIP_H - 8);
    left = r.right + GAP;
  } else if (placement === 'left') {
    top  = Math.min(Math.max(r.top + r.height / 2 - TOOLTIP_H / 2, 8), vh - TOOLTIP_H - 8);
    left = r.left - TOOLTIP_W - GAP;
  }
  // Clamp to viewport
  top  = Math.max(8, Math.min(top,  vh - TOOLTIP_H - 8));
  left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8));
  return { top: `${top}px`, left: `${left}px` };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Tour = ({ run, onFinish }) => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [pos,     setPos]     = useState({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' });
  const doneRef   = useRef(false);
  const hlRef     = useRef(null); // currently highlighted element

  const role  = isSuperAdmin(user) ? 'superadmin' : isDoctor(user) ? 'doctor' : isAssistant(user) ? 'assistant' : 'student';
  const steps = ROLE_STEPS[role] || STUDENT_STEPS;

  // Remove highlight from previous element
  const clearHL = () => {
    if (hlRef.current) {
      hlRef.current.classList.remove('tour-highlight');
      hlRef.current = null;
    }
  };

  // Find element, highlight it, compute tooltip position
  const applyStep = useCallback((stepIdx) => {
    clearHL();
    const cur = steps[stepIdx];
    if (!cur) return;
    if (!cur.selector) {
      setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' });
      return;
    }
    const el = document.querySelector(cur.selector);
    if (el) {
      el.classList.add('tour-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      hlRef.current = el;
      setTimeout(() => {
        const el2 = document.querySelector(cur.selector);
        if (el2) setPos(getPosition(el2, cur.placement || 'bottom'));
      }, 350);
    } else {
      setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' });
    }
  }, [steps]);

  // Start / reset
  useEffect(() => {
    if (run && user) {
      doneRef.current = false;
      setIdx(0);
      setBusy(false);
      const first = steps[0]?.navTo;
      if (first) {
        navigate(first, { replace: true });
        setTimeout(() => { setVisible(true); applyStep(0); }, 500);
      } else {
        setVisible(true);
        applyStep(0);
      }
    } else {
      clearHL();
      setVisible(false);
    }
  }, [run]); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => clearHL(), []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearHL();
    localStorage.setItem(`tour_done_${role}`, '1');
    setVisible(false);
    setIdx(0);
    setBusy(false);
    setTimeout(() => { if (onFinish) onFinish(); }, 60);
  }, [role, onFinish]);

  const goTo = useCallback((next) => {
    if (next >= steps.length) { finish(); return; }
    if (next < 0) return;
    clearHL();
    const cur = steps[next];
    if (cur.navTo && window.location.pathname !== cur.navTo) {
      setBusy(true);
      navigate(cur.navTo, { replace: true });
      setTimeout(() => {
        setIdx(next);
        setBusy(false);
        applyStep(next);
      }, 700);
    } else {
      setIdx(next);
      setTimeout(() => applyStep(next), 80);
    }
  }, [steps, navigate, finish, applyStep]);

  if (!user || !run || !visible) return null;

  const cur    = steps[idx];
  const isLast = idx === steps.length - 1;
  const pct    = Math.round(((idx + 1) / steps.length) * 100);
  const isCentered = !cur.selector || cur.placement === 'center';

  return (
    <div className={`tour-overlay ${isCentered ? 'tour-overlay--dim' : 'tour-overlay--clear'}`}
         onClick={isCentered ? finish : undefined}>
      <div
        className={`tour-tooltip ${isCentered ? 'tour-tooltip--center' : ''}`}
        style={isCentered ? {} : pos}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress */}
        <div className="tour-progress-bar">
          <div className="tour-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Header */}
        <div className="tour-header-row">
          <span className="tour-counter">{idx + 1} / {steps.length}</span>
          <button className="tour-x" onClick={finish}>✕</button>
        </div>

        {/* Body */}
        <div className="tour-body">
          {busy ? (
            <div className="tour-busy"><div className="tour-spinner" /><p>Loading…</p></div>
          ) : (
            <>
              <h3 className="tour-title">{cur.title}</h3>
              <pre className="tour-content">{cur.action}</pre>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="tour-footer">
          <button className="tour-btn-skip" onClick={finish} disabled={busy}>Skip tour</button>
          <div className="tour-nav">
            {idx > 0 && <button className="tour-btn-back" onClick={() => goTo(idx - 1)} disabled={busy}>← Back</button>}
            <button className="tour-btn-next" onClick={() => goTo(idx + 1)} disabled={busy}>
              {isLast ? '🎉 Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tour;
export const shouldAutoLaunchTour = (role) => !localStorage.getItem(`tour_done_${role}`);
export const resetTour            = (role) => localStorage.removeItem(`tour_done_${role}`);


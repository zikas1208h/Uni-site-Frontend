import React, { useState } from 'react';
import { useAuth, isSuperAdmin, isDoctor, isAssistant } from '../context/AuthContext';
import './Help.css';

// ── Feature definitions per role ─────────────────────────────────────────────
const FEATURES = {
  student: [
    {
      icon: '🏠', title: 'Dashboard',
      desc: 'Your home page. Shows your live CGPA, total earned credits, number of enrolled courses, completed courses, and credit eligibility status.',
      details: ['CGPA is calculated automatically from all your graded courses', 'Credit eligibility shows how many credits you can enroll in based on your GPA', 'Recent materials from your enrolled courses appear here'],
    },
    {
      icon: '📚', title: 'Courses',
      desc: 'Browse and enroll in courses available for your major and year.',
      details: ['Only courses matching your major (or shared courses) are shown', 'Prerequisites are checked — you cannot enroll if you haven\'t passed required courses', 'Click Enroll to register; the system checks credit limits automatically'],
    },
    {
      icon: '📝', title: 'Assignments',
      desc: 'View all assignments posted by your doctors and assistants.',
      details: ['Each assignment shows the deadline with hours and minutes remaining', 'Submission types: File Upload, Link, Email, In-Class, or Announcement-only', 'After submitting, your status changes from Pending → Submitted → Reviewed/Graded'],
    },
    {
      icon: '📅', title: 'Schedule',
      desc: 'Your personal weekly timetable showing all lectures and sections for your group.',
      details: ['Lectures are for your full group; sections are split into Section 1 and Section 2', 'Each slot shows course code, room/lab/amphitheatre, time, and type', 'Export your schedule as a PDF from the download button'],
    },
    {
      icon: '📄', title: 'Materials',
      desc: 'Access all learning materials uploaded for your enrolled courses.',
      details: ['Filter by course or material type (Lecture, Section, Video, Extra)', 'Download PDFs, documents, and other files directly', 'Materials are organized by course for easy access'],
    },
    {
      icon: '📊', title: 'Grades',
      desc: 'View your full academic grade record.',
      details: ['Grades are grouped by semester', 'Each semester shows its GPA alongside the cumulative CGPA', 'Grade details include quiz, assignment, and final exam scores where available'],
    },
    {
      icon: '👤', title: 'Profile',
      desc: 'Manage your personal account information.',
      details: ['Update your name, phone, address', 'Upload a profile picture', 'Change your password securely via OTP email verification'],
    },
  ],

  superadmin: [
    {
      icon: '👑', title: 'Admin Dashboard',
      desc: 'Real-time overview of the entire university system.',
      details: ['Shows total students, courses (active/total), enrollments, materials, doctors, assistants', 'Quick action buttons to all major management pages', 'Recent students and staff preview lists'],
    },
    {
      icon: '👨‍🎓', title: 'View Students',
      desc: 'Browse and manage all registered students.',
      details: ['Search by name, ID, or email', 'Filter by major, year, group, section, or enrolled course', 'Click any student to view their full profile, grades, and schedule', 'Export student list as PDF or Excel'],
    },
    {
      icon: '📝', title: 'Manage Grades',
      desc: 'Grade students across all courses.',
      details: ['Select a student then choose an enrolled course', '3 grading modes: Score-based (quiz/assignment/final), Manual letter grade, or Custom weighted components', 'Previous grades are shown and can be edited', 'Bulk import grades from Excel or PDF'],
    },
    {
      icon: '📅', title: 'Schedule Config',
      desc: 'Generate and manage the master weekly schedule.',
      details: ['Set active courses for Semester 4 Year 2', 'Assign doctors and assistants to courses', 'Generate schedule automatically — algorithm respects room capacity, doctor/assistant day limits, and no conflicts', 'View availability of all rooms, labs, and amphitheatres by day and hour', 'Export schedule as PDF for any role'],
    },
    {
      icon: '➕', title: 'Create Course',
      desc: 'Add new courses to the system.',
      details: ['Set course code, name, credits, major, year, semester, and prerequisites', 'Mark courses as active or inactive', 'Assign doctors and assistants directly during creation'],
    },
    {
      icon: '📤', title: 'Upload Material',
      desc: 'Upload learning materials for any course.',
      details: ['Supports PDF, DOC, DOCX, PPT, MP4, and more', 'Tag materials by type: Lecture, Section, Video, or Extra', 'Students in enrolled courses can access immediately'],
    },
    {
      icon: '📈', title: 'Grade Statistics',
      desc: 'University-wide academic analytics.',
      details: ['Per-course statistics: average GPA, pass/fail counts, grade distribution', 'Per-major statistics: averages and student counts', 'Export full report as PDF or Excel with section selection'],
    },
    {
      icon: '🗓️', title: 'Registration Periods',
      desc: 'Control when students can enroll in courses.',
      details: ['Create semester registration windows with open/close dates', 'Toggle periods open or closed manually', 'Students cannot enroll outside active registration periods'],
    },
    {
      icon: '⚙️', title: 'Manage Staff',
      desc: 'Create, edit, and remove doctors and assistants.',
      details: ['Create staff accounts with email and temporary password', 'Assign courses to each staff member', 'Staff must reset their password on first login via OTP', 'Set custom permissions per staff member'],
    },
    {
      icon: '📥', title: 'Import PDF / Excel',
      desc: 'Bulk import student grades from a file.',
      details: ['Upload Excel (.xlsx) or PDF grade sheets', 'System auto-maps student IDs and course codes', 'Preview before confirming import', 'Invalid rows are flagged for manual correction'],
    },
  ],

  doctor: [
    {
      icon: '🎓', title: 'Doctor Dashboard',
      desc: 'Overview of your assigned courses and teaching activity.',
      details: ['Shows your assigned courses (active/total), student count, and material uploads', 'Quick links to grade management and material upload'],
    },
    {
      icon: '👨‍🎓', title: 'Students',
      desc: 'View students enrolled in your courses.',
      details: ['Filter by course, major, year, group', 'Click any student to view their profile and grade history for your courses'],
    },
    {
      icon: '📝', title: 'Manage Grades',
      desc: 'Grade students in your assigned courses.',
      details: ['Score-based: enter quiz, assignment, and final marks — letter grade calculated automatically', 'Manual: select letter grade directly', 'Component-based: define custom weighted grading components', 'View existing grades and edit anytime'],
    },
    {
      icon: '📚', title: 'Materials',
      desc: 'Manage materials for your courses.',
      details: ['View all materials uploaded for your courses', 'Delete or filter by type', 'Upload new materials from the Upload Material page'],
    },
    {
      icon: '📅', title: 'Your Schedule',
      desc: 'Your personal lecture timetable.',
      details: ['Shows only your lectures across all groups and courses', 'Each slot shows the group, course, room, and time', 'Export as PDF'],
    },
    {
      icon: '📝', title: 'Assignments',
      desc: 'Create and manage assignments for your courses.',
      details: ['Create assignments with deadlines, submission types, and file attachments', 'View all student submissions after the deadline', 'Download all submissions as a ZIP file', 'Mark submissions as reviewed and add feedback/marks'],
    },
    {
      icon: '📈', title: 'Grade Statistics',
      desc: 'Analytics for your courses.',
      details: ['Grade distribution charts per course', 'Average GPA and pass rate per course', 'Export as PDF or Excel'],
    },
  ],

  assistant: [
    {
      icon: '📋', title: 'Assistant Dashboard',
      desc: 'Overview of your assigned courses and section activity.',
      details: ['Shows your assigned courses, student count, and material uploads'],
    },
    {
      icon: '👨‍🎓', title: 'Students',
      desc: 'View students in your assigned courses.',
      details: ['Filter and search students', 'View any student\'s profile'],
    },
    {
      icon: '📝', title: 'Grades',
      desc: 'Grade students in your courses and view statistics.',
      details: ['Same grading tools as doctors', 'View grade distribution and statistics for your courses'],
    },
    {
      icon: '📚', title: 'Materials',
      desc: 'Upload and manage section materials.',
      details: ['Upload notes, exercises, and resources for your sections', 'View and delete uploaded materials'],
    },
    {
      icon: '📅', title: 'Your Schedule',
      desc: 'Your personal section timetable.',
      details: ['Shows all your section slots with group, course, lab/room, and time', 'Export as PDF'],
    },
    {
      icon: '📝', title: 'Assignments',
      desc: 'Create and manage section assignments.',
      details: ['Create assignments with deadlines and submission types', 'View and download student submissions as ZIP', 'Add marks and feedback to each submission'],
    },
  ],
};

const RoleCard = ({ icon, title, desc, details }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`help-card ${open ? 'help-card--open' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="help-card-header">
        <span className="help-card-icon">{icon}</span>
        <div className="help-card-info">
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
        <span className="help-card-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <ul className="help-card-details">
          {details.map((d, i) => <li key={i}>✓ {d}</li>)}
        </ul>
      )}
    </div>
  );
};

const Help = () => {
  const { user } = useAuth();
  const role = isSuperAdmin(user) ? 'superadmin'
    : isDoctor(user) ? 'doctor'
    : isAssistant(user) ? 'assistant'
    : 'student';

  const roleLabel = { superadmin: 'Super Admin', doctor: 'Doctor', assistant: 'Assistant', student: 'Student' }[role];
  const roleIcon  = { superadmin: '👑', doctor: '🎓', assistant: '📋', student: '🎓' }[role];
  const features  = FEATURES[role] || FEATURES.student;

  const handleRestartTour = () => {
    if (typeof window.__startTour === 'function') window.__startTour();
  };

  return (
    <div className="help-page">
      <div className="help-hero">
        <div className="help-hero-inner">
          <span className="help-hero-icon">{roleIcon}</span>
          <h1>Help & Feature Guide</h1>
          <p>Everything you can do as a <strong>{roleLabel}</strong> on the HNU Portal.</p>
          <button className="help-tour-btn" onClick={handleRestartTour}>
            🚀 Launch Interactive Tour
          </button>
        </div>
      </div>

      <div className="help-content">
        <div className="help-section-title">
          <h2>📖 Feature Guide</h2>
          <p>Click any feature below to expand details.</p>
        </div>

        <div className="help-cards">
          {features.map((f, i) => <RoleCard key={i} {...f} />)}
        </div>

        <div className="help-tips">
          <h2>💡 Quick Tips</h2>
          <div className="help-tips-grid">
            <div className="help-tip">
              <span>⚡</span>
              <div>
                <strong>Pages load instantly on revisit</strong>
                <p>Cached data shows immediately — fresh data loads in the background.</p>
              </div>
            </div>
            <div className="help-tip">
              <span>📱</span>
              <div>
                <strong>Mobile friendly</strong>
                <p>Use the bottom tab bar on mobile for quick navigation.</p>
              </div>
            </div>
            <div className="help-tip">
              <span>🌙</span>
              <div>
                <strong>Dark mode</strong>
                <p>Toggle dark/light mode from the moon icon in the top bar.</p>
              </div>
            </div>
            <div className="help-tip">
              <span>🌐</span>
              <div>
                <strong>Arabic / English</strong>
                <p>Switch language from the globe icon in the top bar.</p>
              </div>
            </div>
            <div className="help-tip">
              <span>📥</span>
              <div>
                <strong>Export everything</strong>
                <p>Grades, schedules, and reports can all be exported as PDF or Excel.</p>
              </div>
            </div>
            <div className="help-tip">
              <span>🔔</span>
              <div>
                <strong>Notifications</strong>
                <p>The bell icon shows new assignments, grade updates, and announcements.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;









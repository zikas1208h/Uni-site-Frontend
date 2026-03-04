﻿﻿import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

// ── Cache with stale-while-revalidate ────────────────────────────────────
// FRESH_TTL  : return cached value instantly, no network call
// STALE_TTL  : return cached value instantly AND re-fetch in background
const FRESH_TTL = 45_000;   // 45s — fully fresh
const STALE_TTL = 300_000;  // 5min — serve stale, revalidate in bg

const cache = new Map();

const cachedGet = (key, fn) => {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit) {
    const age = now - hit.ts;
    if (age < FRESH_TTL) return hit.promise;          // fully fresh → instant
    if (age < STALE_TTL) {                             // stale → serve old + revalidate
      const fresh = fn().then(r => {
        cache.set(key, { promise: Promise.resolve(r), ts: Date.now() });
        return r;
      }).catch(err => { cache.delete(key); throw err; });
      cache.set(key, { promise: fresh, ts: now });     // update ts so we don't re-trigger
      return hit.promise;                              // return the OLD value immediately
    }
  }
  const promise = fn().catch(err => { cache.delete(key); throw err; });
  cache.set(key, { promise, ts: now });
  return promise;
};

export const clearCache = (pattern) => {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
};

// ── sessionStorage stale-while-revalidate ────────────────────────────────
// Usage: const data = await pageCache('key', () => apiCall())
// • Returns cached data instantly if available (no spinner on revisit)
// • Always re-fetches in background and updates state via onUpdate callback
export const pageCache = async (key, fetcher, onUpdate) => {
  const SK = `pc:${key}`;
  // 1. Serve from sessionStorage instantly
  try {
    const raw = sessionStorage.getItem(SK);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (onUpdate) onUpdate(parsed, false); // false = from cache
      // Re-fetch in background
      fetcher().then(fresh => {
        try { sessionStorage.setItem(SK, JSON.stringify(fresh)); } catch {}
        if (onUpdate) onUpdate(fresh, true); // true = fresh
      }).catch(() => {});
      return parsed;
    }
  } catch {}
  // 2. No cache — fetch and store
  const fresh = await fetcher();
  try { sessionStorage.setItem(SK, JSON.stringify(fresh)); } catch {}
  if (onUpdate) onUpdate(fresh, true);
  return fresh;
};

// ── In-flight deduplication ───────────────────────────────────────────────
const inflight = {};
const dedupe = (key, fn) => {
  if (inflight[key]) return inflight[key];
  inflight[key] = fn().finally(() => { delete inflight[key]; });
  return inflight[key];
};

// ── Auto-retry once on 5xx / network error ────────────────────────────────
api.interceptors.response.use(
  res => res,
  async err => {
    const config = err.config;
    if (!config || config.__retried) return Promise.reject(err);
    const status = err.response?.status;
    const isRetriable = !err.response || status === 503 || status === 502 || status >= 500;
    if (!isRetriable) return Promise.reject(err);
    config.__retried = true;
    await new Promise(r => setTimeout(r, 200));
    return api(config);
  }
);

// ── Token injection ───────────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Keep backend warm — only fire when tab is visible, every 4 min
setInterval(() => {
  if (!localStorage.getItem('token')) return;
  if (document.visibilityState !== 'visible') return; // skip when tab is hidden
  axios.get(`${API_URL}/health`, { timeout: 4000 }).catch(() => {});
}, 4 * 60_000);

// Auth APIs
export const authAPI = {
  login:              (credentials) => api.post('/auth/login', credentials),
  register:           (userData)    => api.post('/auth/register', userData),
  getMe:              ()            => cachedGet('auth:me', () => api.get('/auth/me')),
  sendOtp:            (newEmail)    => api.post('/auth/send-otp', { newEmail }),
  verifyOtp:          (otp)         => api.post('/auth/verify-otp', { otp }),
  setupCredentials:   (data)        => api.post('/auth/setup-credentials', data),
};

// Dashboard stats — single lightweight endpoint replacing 4 heavy calls
export const dashboardAPI = {
  getStats:        () => api.get('/dashboard/stats'),
  getStudentStats: () => api.get('/dashboard/student-stats'),
};

// Student APIs
export const studentAPI = {
  getProfile:          ()           => cachedGet('student:profile', () => api.get('/students/profile')),
  updateProfile:       (data)       => { clearCache('student'); return api.put('/students/profile', data); },
  uploadProfilePicture:(formData)   => api.post('/students/profile/picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAllStudents:       ()           => cachedGet('students:all', () => api.get('/students')),
  getStudentById:      (id)         => cachedGet(`student:${id}`, () => api.get(`/students/${id}`)),
  updateStudent:       (id, data)   => { clearCache('student'); return api.put(`/students/${id}`, data); },
  addCourseToStudent:  (id, cid)    => { clearCache('student'); clearCache('courses'); return api.post(`/students/${id}/courses/${cid}`); },
  removeCourseFromStudent: (id,cid) => { clearCache('student'); clearCache('courses'); return api.delete(`/students/${id}/courses/${cid}`); },
  resetPassword:       (id, pw)     => api.post(`/students/${id}/reset-password`, { password: pw }),
  changePassword:      (data)       => api.post('/students/profile/change-password', data),
};

// Course APIs
export const courseAPI = {
  getAllCourses:       () => cachedGet('courses:all',         () => api.get('/courses')),
  getEnrolledCourses: () => cachedGet('courses:enrolled',    () => api.get('/courses/enrolled')),
  getCourseById:      (id) => cachedGet(`course:${id}`,      () => api.get(`/courses/${id}`)),
  enrollInCourse:     (id) => { clearCache('courses'); clearCache('grades'); return api.post(`/courses/${id}/enroll`); },
  createCourse:       (data) => { clearCache('courses'); return api.post('/courses', data); },
  updateCourse:       (id, data) => { clearCache('courses'); return api.put(`/courses/${id}`, data); },
  deleteCourse:       (id) => { clearCache('courses'); return api.delete(`/courses/${id}`); },
  setCourseStatus:    (id, status) => { clearCache('courses'); return api.patch(`/courses/${id}/status`, { status }); },
  getCreditEligibility: () => cachedGet('courses:eligibility', () => api.get('/courses/eligibility/credit-hours')),
};

// Grade APIs
export const gradeAPI = {
  getStudentGrades:    () => cachedGet('grades:student',          () => api.get('/grades/student')),
  getGPA:              () => cachedGet('grades:gpa',              () => api.get('/grades/gpa')),
  getStatistics:       () => cachedGet('grades:stats',            () => api.get('/grades/statistics')),
  getMyStatistics:     () => cachedGet('grades:my-stats',         () => api.get('/grades/statistics/my-courses')),
  getGradeByCourse:    (id) => cachedGet(`grades:course:${id}`,   () => api.get(`/grades/course/${id}`)),
  getStudentGradesById:(id) => cachedGet(`grades:by-student:${id}`, () => api.get(`/grades/admin/student/${id}`)),
  addGrade:            (data) => { clearCache('grades'); return api.post('/grades', data); },
  deleteGrade:         (id)   => { clearCache('grades'); return api.delete(`/grades/${id}`); },
};

// Material APIs
export const materialAPI = {
  getMaterialsByCourse: (id) => cachedGet(`materials:course:${id}`, () => api.get(`/materials/course/${id}`)),
  getMyMaterials:       ()   => cachedGet('materials:my', () => api.get('/materials/my-materials')),
  getAllMaterials:       ()   => cachedGet('materials:all', () => api.get('/materials/all')),
  getMaterialById:      (id) => cachedGet(`material:${id}`, () => api.get(`/materials/${id}`)),
  uploadMaterial:       (fd) => { clearCache('materials'); return api.post('/materials', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  updateMaterial:       (id, data) => { clearCache('materials'); return api.put(`/materials/${id}`, data); },
  deleteMaterial:       (id) => { clearCache('materials'); return api.delete(`/materials/${id}`); },
};

// Staff Management APIs
export const staffAPI = {
  getAll:        () => cachedGet('staff:all', () => api.get('/auth/staff')),
  create:        (data) => { clearCache('staff'); return api.post('/auth/staff', data); },
  update:        (id, data) => { clearCache('staff'); return api.put(`/auth/staff/${id}`, data); },
  remove:        (id) => { clearCache('staff'); return api.delete(`/auth/staff/${id}`); },
  semesterReset: () => api.post('/auth/staff/semester-reset'),
};

// Registration Period APIs
export const registrationAPI = {
  getCurrentSemester: () => cachedGet('registration:semester', () => api.get('/registration/current-semester')),
  getActivePeriod:    () => cachedGet('registration:active',   () => api.get('/registration/active')),
  getAllPeriods:       () => cachedGet('registration:all',      () => api.get('/registration')),
  getCoursesByYear:   (params) => api.get('/registration/courses-by-year', { params }),
  createPeriod:       (data)   => { clearCache('registration'); return api.post('/registration', data); },
  updatePeriod:       (id, data) => { clearCache('registration'); return api.put(`/registration/${id}`, data); },
  togglePeriod:       (id)     => { clearCache('registration'); return api.patch(`/registration/${id}/toggle`); },
  deletePeriod:       (id)     => { clearCache('registration'); return api.delete(`/registration/${id}`); },
};

// Assignment APIs
export const assignmentAPI = {
  getMyAssignments:    () => cachedGet('assignments:my',    () => api.get('/assignments/my')),
  getStaffAssignments: () => cachedGet('assignments:staff', () => api.get('/assignments/staff')),
  getById:           (id) => cachedGet(`assignment:${id}`, () => api.get(`/assignments/${id}`)),
  create:            (fd) => { clearCache('assignment'); return api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  update:            (id, fd) => { clearCache('assignment'); return api.put(`/assignments/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  delete:            (id) => { clearCache('assignment'); return api.delete(`/assignments/${id}`); },
  getDownloadUrl:    (id) => `${API_URL}/api/assignments/download/${id}`,
  // Grade components — auto-loaded from course assignments/exams
  getCourseComponents: (courseId) => api.get(`/assignments/course/${courseId}/components`),
  gradeStudent:        (assignmentId, studentId, score) => api.patch(`/assignments/${assignmentId}/grade-student`, { studentId, score }),
};

// Submission APIs
export const submissionAPI = {
  submit: (assignmentId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('assignmentId', assignmentId);
    return api.post('/submissions', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getMySubmission:     (id) => api.get(`/submissions/my/${id}`),
  getByAssignment:     (id) => api.get(`/submissions/assignment/${id}`),
  saveFeedback:        (id, data) => api.patch(`/submissions/${id}/feedback`, data),
  getDownloadUrl:      (id) => `${API_URL}/api/submissions/download/${id}`,
  getDownloadAllUrl:   (assignmentId) => `${API_URL}/api/submissions/assignment/${assignmentId}/download-all`,
  markAllReviewed:     (assignmentId) => api.patch(`/submissions/assignment/${assignmentId}/grade-all`),
};

// Notification APIs
export const notificationAPI = {
  getAll:         () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead:       (id) => api.patch(`/notifications/${id}/read`),
  markAllRead:    () => api.patch('/notifications/read-all'),
  delete:         (id) => api.delete(`/notifications/${id}`),
};

// Schedule APIs
export const scheduleAPI = {
  getMySchedule:       () => cachedGet('schedule:me',      () => api.get('/schedule/me')),
  generateMySchedule:  () => { clearCache('schedule'); return api.post('/schedule/generate/me'); },
  getStudentSchedule:  (id) => cachedGet(`schedule:${id}`, () => api.get(`/schedule/${id}`)),
  generateForStudent:  (id) => { clearCache('schedule'); return api.post(`/schedule/generate/${id}`); },
  generateAll:         () => api.post('/schedule/generate-all'),
  generateMaster:      (params) => { clearCache('schedule'); return api.post('/schedule/generate-master', params || {}); },
  getMaster:           () => cachedGet('schedule:master',  () => api.get('/schedule/master')),
  deleteMaster:        () => { clearCache('schedule'); return api.delete('/schedule/master'); },
  getVenues:           () => cachedGet('schedule:venues',  () => api.get('/schedule/venues')),
  getGroupSchedule:    (group, section) => api.get(`/schedule/group/${group}/${section}`),
  forceGroupSchedule:  (group, section) => { clearCache('schedule'); return api.post(`/schedule/force-group/${group}/${section}`); },
  getMyStaffSchedule:  () => api.get('/schedule/staff/me'),
  getStaffSchedule:    (id) => api.get(`/schedule/staff/${id}`),
  getStaffList:        () => api.get('/schedule/staff-list'),
  forceStaffAll:       () => { clearCache('schedule'); return api.post('/schedule/force-staff-all'); },
  getConfig:           () => cachedGet('schedule:config',  () => api.get('/schedule/config')),
  saveConfig:          (data) => { clearCache('schedule'); return api.put('/schedule/config', data); },
  getCourseStaff:      () => cachedGet('schedule:course-staff', () => api.get('/schedule/course-staff')),
  setCourseStaff:      (courseId, data) => { clearCache('schedule'); return api.put(`/schedule/course-staff/${courseId}`, data); },
};

// Import PDF APIs
export const importAPI = {
  preview: (fd) => api.post('/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  apply:   (fd) => api.post('/import', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
};

export default api;

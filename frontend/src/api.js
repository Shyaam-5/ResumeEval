import axios from 'axios';

const API = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// ──── Admin APIs ────
export const adminLogin = (data) => API.post('/admin/login', data);
export const uploadResume = (formData) =>
    API.post('/admin/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
export const getCandidates = () => API.get('/admin/candidates');
export const getCandidate = (id) => API.get(`/admin/candidates/${id}`);
export const deleteCandidate = (id) => API.delete(`/admin/candidates/${id}`);
export const generateTest = (candidateId) => API.post(`/admin/generate-test/${candidateId}`);
export const getDashboard = () => API.get('/admin/dashboard');
export const getAllReports = () => API.get('/admin/reports');
export const getCandidateReport = (id) => API.get(`/admin/report/${id}`);
export const resetDatabase = () => API.post('/admin/reset-database');
export const generateReport = (candidateId) => API.post(`/admin/generate-report/${candidateId}`);

// ──── Candidate APIs ────
export const candidateLogin = (data) => API.post('/candidate/login', data);
export const getTestInfo = (candidateId) => API.get(`/student/test-info/${candidateId}`);

// ──── MCQ Test APIs ────
export const startMCQ = (testId) => API.post(`/student/start-mcq/${testId}`);
export const submitMCQ = (data) => API.post('/student/submit-mcq', data);

// ──── Coding Test APIs ────
export const startCoding = (testId) => API.post(`/student/start-coding/${testId}`);
export const submitCode = (data) => API.post('/student/submit-code', data);
export const finishCoding = (testId) => API.post(`/student/finish-coding/${testId}`);
export const runCode = (data) => API.post('/student/run-code', data);

// ──── SQL Test APIs ────
export const runSQL = (data) => API.post('/student/run-sql', data);
export const evaluateSQL = (data) => API.post('/student/evaluate-sql', data);
export const finishSQL = (candidateId) => API.post(`/student/finish-sql/${candidateId}`);

// ──── Interview APIs ────
export const startInterview = (interviewId) => API.post(`/student/start-interview/${interviewId}`);
export const answerInterview = (data) => API.post('/student/answer-interview', data);

// ──── TTS API ────
export const textToSpeech = (text) => API.post('/tts', { text }, { responseType: 'blob' });

// ──── Proctoring APIs ────
export const logProctoringEvent = (data) => API.post('/proctoring/log', data);
export const getProctoringLogs = (candidateId) => API.get(`/proctoring/logs/${candidateId}`);

export default API;

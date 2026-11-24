import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adaptiq_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('adaptiq_refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = res.data.data;

          localStorage.setItem('adaptiq_access_token', accessToken);
          localStorage.setItem('adaptiq_refresh_token', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          // Token refresh failed, clear local state
          localStorage.removeItem('adaptiq_access_token');
          localStorage.removeItem('adaptiq_refresh_token');
          localStorage.removeItem('adaptiq_user');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (credentials) => api.post('/auth/login', credentials),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me')
};

export const proctorAPI = {
  saveConsent: (data) => api.post('/proctor/consent', data),
  getConsent: () => api.get('/proctor/consent'),
  enrolBiometrics: (sessionId, data) => api.post(`/proctor/session/${sessionId}/enrol`, data),
  getSessionStatus: (sessionId) => api.get(`/proctor/session/${sessionId}/status`),
  checkTextAIRisk: (data) => api.post('/proctor/check-text', data),
  uploadEvidence: (formData) =>
    api.post('/proctor/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  getActiveSessions: () => api.get('/proctor/active-sessions'),
  executeSessionAction: (sessionId, data) => api.post(`/proctor/session/${sessionId}/action`, data),
  getSessionAuditLogs: (sessionId) => api.get(`/proctor/audit-logs/${sessionId}`),
  cleanupEvidence: () => api.post('/proctor/evidence/cleanup'),
  getSessionReviewTimeline: (sessionId) => api.get(`/proctor/session/${sessionId}/review`),
  submitReviewAction: (sessionId, data) => api.post(`/proctor/session/${sessionId}/review-action`, data),
  getTuningMetrics: () => api.get('/proctor/tuning-metrics')
};

export const fairnessAPI = {
  getOverview: () => api.get('/fairness/overview'),
  getQuestionsDIF: () => api.get('/fairness/questions-dif'),
  getReviewQueue: () => api.get('/fairness/review-queue'),
  resolveReviewQueueItem: (id, data) => api.post(`/fairness/review-queue/${id}/resolve`, data),
  getAuditLogs: () => api.get('/fairness/audit-logs'),
  getProctoringFairness: () => api.get('/fairness/proctoring'),
  setAccessibilityOverride: (candidateId, data) =>
    api.post(`/fairness/accessibility-override/${candidateId}`, data)
};

export const sessionAPI = {
  uploadAnswerAudio: (sessionId, formData) =>
    api.post(`/sessions/${sessionId}/answer-audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  submitAnswer: (sessionId, data) => api.post(`/sessions/${sessionId}/answer`, data),
  exitSession: (sessionId, data) => api.post(`/sessions/${sessionId}/exit`, data),
  recordAuditEvent: (sessionId, data) => api.post(`/sessions/${sessionId}/audit-event`, data)
};

export default api;

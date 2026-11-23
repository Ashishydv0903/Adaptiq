import express from 'express';
import multer from 'multer';
import {
  saveProctorConsent,
  getProctorConsent,
  enrolFaceBiometrics,
  getProctorSessionStatus,
  checkTextAIRisk,
  uploadEvidence,
  streamEvidence,
  getActiveProctorSessions,
  executeRecruiterSessionAction,
  getSessionAuditTrail,
  triggerEvidenceRetentionCleanup,
  getSessionReviewTimeline,
  postSessionReviewAction,
  getFalsePositiveTuningReport
} from '../controllers/proctorController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Memory upload for 10-second rolling MediaRecorder video buffer or snapshot
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max buffer
  }
});

// Require authentication for all proctoring routes
router.use(authenticate);

// Consent endpoints
router.post('/consent', saveProctorConsent);
router.get('/consent', getProctorConsent);

// Biometric enrolment endpoints
router.post('/enrol', enrolFaceBiometrics);
router.post('/session/:sessionId/enrol', enrolFaceBiometrics);

// Status endpoint
router.get('/session/:sessionId/status', getProctorSessionStatus);

// AI Text Risk Indicator (burstiness + LLM)
router.post('/check-text', checkTextAIRisk);

// Evidence handling (GridFS/Cloud storage)
router.post('/evidence', upload.single('videoBuffer'), uploadEvidence);
router.get('/evidence/:id', streamEvidence);
router.post('/evidence/cleanup', triggerEvidenceRetentionCleanup);

// Recruiter live-monitor active session grid & actions
router.get('/active-sessions', getActiveProctorSessions);
router.post('/session/:sessionId/action', executeRecruiterSessionAction);
router.get('/audit-logs/:sessionId', getSessionAuditTrail);

// Post-Session Timeline Review & Human-in-the-Loop Actions
router.get('/session/:sessionId/review', getSessionReviewTimeline);
router.post('/session/:sessionId/review-action', postSessionReviewAction);

// Threshold Tuning Report
router.get('/tuning-metrics', getFalsePositiveTuningReport);

export default router;

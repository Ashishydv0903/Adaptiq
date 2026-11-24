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
import { authenticate, authorize } from '../middleware/auth.js';
import { sessionParamOwnership, requireSessionOwnership, requireEvidenceOwnership } from '../middleware/ownership.js';

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

// Enforce session ownership on any route containing :sessionId
router.param('sessionId', sessionParamOwnership);

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
router.get('/evidence/:id', requireEvidenceOwnership, streamEvidence);
router.post('/evidence/cleanup', authorize('recruiter', 'admin'), triggerEvidenceRetentionCleanup);

// Recruiter live-monitor active session grid & actions
router.get('/active-sessions', authorize('recruiter', 'admin'), getActiveProctorSessions);
router.post('/session/:sessionId/action', authorize('recruiter', 'admin'), executeRecruiterSessionAction);
router.get('/audit-logs/:sessionId', requireSessionOwnership('sessionId'), getSessionAuditTrail);

// Post-Session Timeline Review & Human-in-the-Loop Actions
router.get('/session/:sessionId/review', getSessionReviewTimeline);
router.post('/session/:sessionId/review-action', authorize('recruiter', 'admin'), postSessionReviewAction);

// Threshold Tuning Report
router.get('/tuning-metrics', getFalsePositiveTuningReport);

export default router;

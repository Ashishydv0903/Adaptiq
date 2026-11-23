import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  startSession,
  submitAnswer,
  getSessionById,
  getMyActiveSession,
  getMySessionHistory,
  finishSession,
  logIntegrityEvent,
  evaluateResponse,
  getEvaluationFeedback,
  getAllSessionEvaluations,
  pauseSession,
  resumeSession,
  generateQuestionFollowUp,
  answerFollowUp,
  evaluateStar,
  executeCodingTests,
  reviewCodingSolution,
  unlockQuestionHint,
  submitVoiceAnswer,
  recordConfidenceTrend,
  downloadSessionPdfReport,
  startPracticeSession,
  startTargetedSession,
  getComprehensiveSessionFeedback,
  handleAnswerAudio,
  exitSession,
  recordAuditEvent
} from '../controllers/sessionController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB audio limit
});

const startSessionSchema = z.object({
  track: z.enum(['frontend', 'backend', 'fullstack', 'devops', 'datascience']).default('fullstack')
});

const submitAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  answer: z.string(),
  durationSeconds: z.number().optional().default(30),
  language: z.string().optional(),
  inputMode: z.enum(['type', 'speak', 'hybrid']).optional().default('type'),
  transcript: z.string().optional().default(''),
  audioUrl: z.string().optional().default(''),
  editedAfterTranscription: z.boolean().optional().default(false),
  speechMetrics: z.record(z.any()).optional().nullable(),
  spokenExplanation: z.record(z.any()).optional().nullable()
});

const evaluateResponseSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  answer: z.string().default(''),
  telemetry: z.record(z.any()).optional().default({})
});

const followUpSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  candidateAnswer: z.string().default('')
});

const answerFollowUpSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  followUpIndex: z.number().optional().default(0),
  answer: z.string().default('')
});

const starSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  candidateAnswer: z.string().default('')
});

const executeCodeSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  sourceCode: z.string().default(''),
  language: z.enum(['javascript', 'python', 'java', 'cpp']).default('javascript'),
  isSubmission: z.boolean().default(false)
});

const reviewCodeSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  sourceCode: z.string().default(''),
  language: z.enum(['javascript', 'python', 'java', 'cpp']).default('javascript')
});

const hintSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  hintLevel: z.number().min(1).max(3)
});

const confidenceTrendSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  confidenceScores: z
    .array(
      z.object({
        timestamp: z.number(),
        confidence: z.number().min(0).max(100)
      })
    )
    .default([])
});

const integrityEventSchema = z.object({
  eventType: z.enum([
    'tab_switch',
    'window_blur',
    'paste_anomaly',
    'fullscreen_exit',
    'multiple_faces',
    'time_expired_anomaly'
  ]).default('tab_switch'),
  metadata: z.record(z.any()).optional().default({})
});

// All session routes require authentication
router.use(authenticate);

router.post('/start', validate(startSessionSchema), startSession);
router.post('/start-targeted', startTargetedSession);
router.get('/my/active', getMyActiveSession);
router.get('/my/history', getMySessionHistory);
router.get('/:id', getSessionById);
router.post('/:id/answer', validate(submitAnswerSchema), submitAnswer);
router.post('/:id/finish', finishSession);
router.post('/:id/integrity-event', validate(integrityEventSchema), logIntegrityEvent);

// Pause and Resume Flow
router.post('/:id/pause', pauseSession);
router.post('/:id/resume', resumeSession);
router.post('/:id/exit', exitSession);
router.post('/:id/audit-event', recordAuditEvent);

// LLM Follow-Ups & STAR Evaluation
router.post('/:id/follow-up', validate(followUpSchema), generateQuestionFollowUp);
router.post('/:id/answer-follow-up', validate(answerFollowUpSchema), answerFollowUp);
router.post('/:id/evaluate-star', validate(starSchema), evaluateStar);

// Coding Round (Monaco + Judge0 + Hint Ladder + LLM Review)
router.post('/:id/execute-code', validate(executeCodeSchema), executeCodingTests);
router.post('/:id/review-code', validate(reviewCodeSchema), reviewCodingSolution);
router.post('/:id/unlock-hint', validate(hintSchema), unlockQuestionHint);

// Voice Mode & Dual-Input Whisper Transcription
router.post('/:id/voice-answer', audioUpload.single('audio'), submitVoiceAnswer);
router.post('/:id/answer-audio', audioUpload.single('audio'), handleAnswerAudio);

// Optional Consent-Gated MediaPipe Confidence Trend (EXCLUDED from scoring)
router.post('/:id/confidence-trend', validate(confidenceTrendSchema), recordConfidenceTrend);

// Scoring Pipeline & XAI Feedback
router.post('/:id/evaluate-response', validate(evaluateResponseSchema), evaluateResponse);
router.get('/:id/comprehensive-feedback', getComprehensiveSessionFeedback);
router.get('/:id/feedback/:questionId', getEvaluationFeedback);
router.get('/:id/evaluations', getAllSessionEvaluations);

// Practice Mode & PDF Report Export
router.post('/practice/start', startPracticeSession);
router.post('/:id/export-pdf', downloadSessionPdfReport);
router.get('/:id/export-pdf', downloadSessionPdfReport);

export default router;

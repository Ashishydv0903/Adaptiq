/**
 * @file Fairness, Bias Auditing, Review Queue & Audit Log Routes
 */

import express from 'express';
import { z } from 'zod';
import {
  getMyDemographics,
  updateMyDemographics,
  getFairnessOverview,
  getQuestionsDIFAudit,
  toggleQuestionQuarantine,
  runLLMBiasTest,
  getReviewQueue,
  resolveReviewQueueItem,
  getAuditLogs,
  getProctoringFairness,
  configureAccessibility
} from '../controllers/fairnessController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const demographicsSchema = z.object({
  gender: z.string().optional(),
  ethnicity: z.string().optional(),
  ageGroup: z.string().optional(),
  disabilityStatus: z.string().optional(),
  veteranStatus: z.string().optional(),
  consentGiven: z.boolean().default(true)
});

const quarantineSchema = z.object({
  action: z.enum(['quarantine', 'approve']),
  reason: z.string().min(3, 'Reason must be at least 3 characters long')
});

const resolveQueueSchema = z.object({
  action: z.enum([
    'override',
    'approve',
    'dismiss',
    'confirm_violation',
    'dismiss_false_positive',
    'request_retest',
    'confirm',
    'retest'
  ]),
  overriddenScore: z.number().min(0).max(100).optional(),
  recruiterNotes: z.string().default('')
});

const llmBiasTestSchema = z.object({
  questionTitle: z.string().optional(),
  questionPrompt: z.string().optional(),
  baseAnswer: z.string().min(10, 'Base candidate answer is required')
});

// All routes require authentication
router.use(authenticate);

// Candidate demographic routes
router.get('/demographics/my', getMyDemographics);
router.post('/demographics/my', validate(demographicsSchema), updateMyDemographics);
router.put('/demographics/my', validate(demographicsSchema), updateMyDemographics);

// Admin & Recruiter fairness metrics & DIF
router.get('/overview', authorize('admin', 'recruiter'), getFairnessOverview);
router.get('/questions-dif', authorize('admin', 'recruiter'), getQuestionsDIFAudit);
router.post(
  '/questions/:id/quarantine',
  authorize('admin'),
  validate(quarantineSchema),
  toggleQuestionQuarantine
);

// LLM Paraphrase Bias Test Benchmark
router.post(
  '/llm-bias-test',
  authorize('admin'),
  validate(llmBiasTestSchema),
  runLLMBiasTest
);

// Human Review Queue & Recruiter Override
router.get('/review-queue', authorize('recruiter', 'admin'), getReviewQueue);
router.post(
  '/review-queue/:id/resolve',
  authorize('recruiter', 'admin'),
  validate(resolveQueueSchema),
  resolveReviewQueueItem
);

// Extended Proctoring Fairness Metrics & Accessibility Accommodation Override
router.get('/proctoring', authorize('admin', 'recruiter'), getProctoringFairness);
router.post('/accessibility-override/:candidateId', authorize('admin'), configureAccessibility);

// Governance Audit Trail
router.get('/audit-logs', authorize('admin'), getAuditLogs);

export default router;
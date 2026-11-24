/**
 * @file Skill Gap Analysis & Roadmap Routes
 */

import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  getSkillGraphData,
  uploadAndParseResume,
  analyzeJobDescription,
  generateAssessmentFromJD,
  generateCandidateRoadmap,
  updateRoadmapProgress,
  downloadRoadmapPdf,
  getInterviewSkillGapsSummary,
  scoreResumeAgainstJD
} from '../controllers/skillGapController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireRoadmapOwnership } from '../middleware/ownership.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const jdAnalyzeSchema = z.object({
  jdText: z.string().min(10, 'Job description must be at least 10 characters long')
});

const roadmapSchema = z.object({
  targetRole: z.string().default('Fullstack Engineer'),
  matchPercentage: z.number().optional().default(65),
  skillGaps: z.array(z.any()).default([])
});

const progressSchema = z.object({
  milestoneIndex: z.number().default(0),
  resourceIndex: z.number().default(0),
  isCompleted: z.boolean().default(true)
});

// All routes require authentication
router.use(authenticate);

// Interview Summary & Proven Skills vs Gaps
router.get('/my-interview-summary', getInterviewSkillGapsSummary);

// Skill Graph & Taxonomy
router.get('/graph', getSkillGraphData);

// Resume Upload & Claimed vs Proven
router.post('/resume-parse', upload.single('resume'), uploadAndParseResume);

// JD Analysis & Assessment Generation
router.post('/score-resume-jd', scoreResumeAgainstJD);
router.post('/jd-analyze', validate(jdAnalyzeSchema), analyzeJobDescription);
router.post('/jd-generate-assessment', generateAssessmentFromJD);

// Roadmap & Progress
router.post('/roadmap', validate(roadmapSchema), generateCandidateRoadmap);
router.patch('/roadmap/:id/progress', requireRoadmapOwnership, validate(progressSchema), updateRoadmapProgress);

// PDF Export
router.post('/roadmap/export-pdf', downloadRoadmapPdf);

export default router;

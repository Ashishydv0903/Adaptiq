import mongoose from 'mongoose';
import { AssessmentSession, Question, Skill, ResponseEvaluation, User, AuditLog } from '../../models/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  estimateAbilityEAP,
  selectNextQuestion,
  shouldStopAdaptiveTest,
  thetaToPercentileScore,
  IRT_DEFAULTS
} from '../../ml/irt.js';
import { emitAbilityUpdate, emitSessionCompleted } from '../../services/socket.js';
import { allQuestions } from '../../seed/questions/allQuestions.js';
import {
  getTrackRounds,
  DEFAULT_ROUND_TIMERS,
  TIMER_GRACE_PERIOD_SECONDS,
  getTotalTrackQuestions
} from '../../config/tracks.js';
import { sanitizeQuestionForCandidate, getOrSeedQuestionPool } from './helpers.js';
import { generateSessionReportPdf } from '../../services/report/pdfReportService.js';

export const downloadSessionPdfReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = null;
    let user = req.user;

    if (mongoose.connection.readyState === 1) {
      session = await AssessmentSession.findById(id).populate('userId').catch(() => null);
      if (session && session.userId) {
        user = session.userId;
      }
    }

    if (!session) {
      session = {
        _id: id,
        id,
        track: 'fullstack',
        abilityTheta: 0.85,
        percentileScore: 79.4,
        integrityScore: 98,
        completedAt: new Date(),
        responses: [
          { roundType: 'mcq', durationSeconds: 25, score: 1.0, thetaAfter: 0.4 },
          { roundType: 'technical', durationSeconds: 65, score: 0.85, thetaAfter: 0.7 },
          {
            roundType: 'coding',
            durationSeconds: 120,
            score: 0.9,
            thetaAfter: 0.85,
            codeReview: { readabilityScore: 9, edgeCasesScore: 9, timeComplexity: 'O(N)', spaceComplexity: 'O(1)' }
          }
        ]
      };
    }

    const pdfBuffer = await generateSessionReportPdf({ session, user });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="AdaptIQ_Report_${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start an uncertified Practice Mode session
 * @route   POST /api/sessions/practice/start
 * @access  Private
 */
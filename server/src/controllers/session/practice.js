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

export const startPracticeSession = async (req, res, next) => {
  try {
    const { track = 'fullstack' } = req.body;
    const candidateId = req.user?.id || req.user?._id;
    const pool = await getOrSeedQuestionPool(track);
    const initialQuestion = pool[0] || allQuestions[0];

    let session = null;
    if (candidateId && mongoose.connection.readyState === 1) {
      session = await AssessmentSession.create({
        candidateId,
        userId: candidateId,
        track,
        isPractice: true,
        isProctored: false,
        status: 'in_progress',
        currentRound: 'technical',
        currentQuestionId: initialQuestion._id || initialQuestion.id,
        currentQuestionAllowedSeconds: 180,
        currentQuestionStartedAt: new Date(),
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0
      });
    }

    const practiceSession = session || {
      _id: `practice_${Date.now()}`,
      id: `practice_${Date.now()}`,
      userId: candidateId,
      candidateId,
      track,
      isPractice: true,
      isProctored: false,
      currentRound: 'technical',
      status: 'in_progress',
      abilityTheta: 0.0,
      abilitySem: 1.0,
      percentileScore: 50.0,
      currentQuestionId: initialQuestion._id || initialQuestion.id,
      timer: { remainingSeconds: 180 }
    };

    res.status(201).json({
      success: true,
      message: 'Practice mode session started (uncertified, does not impact hiring record)',
      data: {
        session: practiceSession,
        currentQuestion: sanitizeQuestionForCandidate(initialQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start a targeted mock interview tailored to candidate's Resume & target Job Description
 *          Covers Resume deep dive, Core CS concepts, DSA algorithms, and real job screening skills.
 * @route   POST /api/sessions/start-targeted
 * @access  Private (Candidate)
 */
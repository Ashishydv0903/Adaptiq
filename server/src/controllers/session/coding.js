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
import { executeAllTestCases } from '../../services/judge0/judge0Service.js';
import { reviewCodeWithLLM } from '../../services/scoring/codeReviewer.js';

export const executeCodingTests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, sourceCode, code = '', language = 'javascript', isSubmission = false } = req.body;
    const finalSource = sourceCode || code || '';

    let question = null;
    if (questionId) {
      question = await Question.findById(questionId).catch(() => null);
      if (!question) {
        question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
      }
    }

    if (!question && id) {
      const session = await AssessmentSession.findById(id).catch(() => null);
      if (session) {
        const respLen = session.responses?.length || 0;
        const currentQ = session.customQuestions?.[respLen] || session.customQuestions?.[0];
        if (currentQ) {
          question = (await Question.findById(currentQ._id || currentQ.id).catch(() => null)) || currentQ;
        }
      }
    }

    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    const executionResult = await executeAllTestCases({
      sourceCode: finalSource,
      language,
      testCases: question.testCases || [],
      isSubmission
    });

    res.status(200).json({
      success: true,
      data: {
        execution: executionResult,
        ...executionResult
      }
    });
  } catch (error) {
    if (error.code === 'EXECUTION_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        code: 'EXECUTION_UNAVAILABLE',
        message: 'Code execution is unavailable right now. Retry, or continue without running.'
      });
    }
    next(error);
  }
};

/**
 * @desc    Generate LLM automated code review (readability, edge cases, complexity)
 * @route   POST /api/sessions/:id/review-code
 * @access  Private
 */

export const reviewCodingSolution = async (req, res, next) => {
  try {
    const { questionId, sourceCode = '', language = 'javascript' } = req.body;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question) {
      question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    const review = await reviewCodeWithLLM({
      question,
      sourceCode,
      language
    });

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unlock costed hint (Level 1, 2, or 3) and deduct penalty points
 * @route   POST /api/sessions/:id/unlock-hint
 * @access  Private
 */
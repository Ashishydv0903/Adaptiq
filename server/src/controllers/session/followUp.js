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
import { generateFollowUp } from '../../services/llm/followUpGenerator.js';
import { executeScoringPipeline } from '../../services/scoring/index.js';

export const generateQuestionFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, candidateAnswer } = req.body;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question && session.customQuestions && session.customQuestions.length > 0) {
      question = session.customQuestions.find(
        (q) => String(q._id) === String(questionId) || String(q.id) === String(questionId) || q.title === questionId
      );
      if (!question && session.isTargeted) {
        const currIdx = session.responses ? session.responses.length : 0;
        question = session.customQuestions[currIdx] || session.customQuestions[0];
      }
    }
    if (!question) {
      question = allQuestions.find(
        (q) => (q._id || q.id) === questionId || String(q._id) === String(questionId) || q.title === questionId
      );
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    const session = await AssessmentSession.findById(id).catch(() => null);
    const lastResponse = session?.responses?.find(
      (r) => r.questionId.toString() === (question._id || question.id).toString()
    );
    const previousFollowUps = lastResponse?.followUps || [];

    const followUp = await generateFollowUp({
      question,
      candidateAnswer,
      previousFollowUps
    });

    if (session && followUp.shouldFollowUp && lastResponse) {
      lastResponse.followUps.push({
        type: followUp.type,
        followUpPrompt: followUp.followUpPrompt,
        contextRationale: followUp.contextRationale,
        expectedFocus: followUp.expectedFocus
      });
      if (session.save) await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: followUp
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit answer to an LLM follow-up question
 * @route   POST /api/sessions/:id/answer-follow-up
 * @access  Private
 */

export const answerFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, followUpIndex = 0, answer } = req.body;

    const session = await AssessmentSession.findById(id).catch(() => null);
    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const response = session.responses.find(
      (r) => r.questionId.toString() === questionId.toString()
    );

    if (!response || !response.followUps || !response.followUps[followUpIndex]) {
      return next(new AppError('Follow-up not found for this response', 404));
    }

    response.followUps[followUpIndex].candidateAnswer = answer;
    response.followUps[followUpIndex].answeredAt = new Date();
    response.followUps[followUpIndex].score = 8.0;

    if (session.save) await session.save().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Follow-up answer recorded',
      data: {
        followUp: response.followUps[followUpIndex]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Evaluate behavioral response using the STAR framework
 * @route   POST /api/sessions/:id/evaluate-star
 * @access  Private
 */
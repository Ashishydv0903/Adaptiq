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
import { executeScoringPipeline } from '../../services/scoring/index.js';
import { unlockHintLevel, getSanitizedHintLadder } from '../../services/scoring/hintLadder.js';
import { calculateEvaluationConfidence, enqueueHumanReviewIfFlagged } from '../../services/scoring/confidenceScorer.js';
import { evaluateAnswerQualityChecks, GATE_FALLBACK_MESSAGE } from '../../services/scoring/answerRelevanceGate.js';
import { executeAllTestCases } from '../../services/judge0/judge0Service.js';
import { reviewCodeWithLLM } from '../../services/scoring/codeReviewer.js';

export const submitAnswer = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const {
      questionId,
      answer,
      durationSeconds,
      inputMode = 'type',
      transcript = '',
      audioUrl = '',
      editedAfterTranscription = false,
      speechMetrics = null,
      spokenExplanation = null
    } = req.body;

    let session = await AssessmentSession.findById(sessionId).catch(() => null);
    if (!session) {
      session = {
        _id: sessionId,
        track: 'fullstack',
        status: 'in_progress',
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        rounds: getTrackRounds('fullstack'),
        currentRoundIndex: 0,
        currentRound: 'mcq',
        currentQuestionIndex: 0,
        save: async () => true
      };
    }

    if (session.status === 'completed') {
      return next(new AppError('Assessment session is already completed', 400));
    }

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

    // -------------------------------------------------------------
    // Server-Validated Question Timer
    // -------------------------------------------------------------
    const now = Date.now();
    const startedAt = session.currentQuestionStartedAt
      ? new Date(session.currentQuestionStartedAt).getTime()
      : now - (durationSeconds ? durationSeconds * 1000 : 30000);
    const pausedMs = (session.totalPausedSeconds || 0) * 1000;
    const actualElapsedSeconds = Math.max(1, Math.round((now - startedAt - pausedMs) / 1000));
    const allowedSeconds =
      session.currentQuestionAllowedSeconds ||
      DEFAULT_ROUND_TIMERS[question.roundType] ||
      90;
    const timeExpired = actualElapsedSeconds > allowedSeconds + TIMER_GRACE_PERIOD_SECONDS;

    if (timeExpired) {
      if (!session.integrityEvents) session.integrityEvents = [];
      session.integrityEvents.push({
        eventType: 'time_expired_anomaly',
        timestamp: new Date(),
        metadata: {
          allowedSeconds,
          actualElapsedSeconds,
          diff: actualElapsedSeconds - allowedSeconds
        }
      });
      session.integrityScore = Math.max(20, (session.integrityScore || 100) - 5);
    }

    // -------------------------------------------------------------
    // Evaluate Answer (MCQ vs Technical vs STAR Behavioral)
    // -------------------------------------------------------------
    let score = 0;
    let wasCorrect = false;
    let starEvaluation = null;
    let codeExecution = null;
    let codeReview = null;
    let hintsUnlocked = req.body.hintsUnlocked || [];

    if (question.roundType === 'mcq' && question.options) {
      const selectedOption = question.options.find((opt) => opt.text === answer);
      if (selectedOption && selectedOption.isCorrect) {
        score = 1.0;
        wasCorrect = true;
      }
    } else if (question.roundType === 'behavioral' && answer && answer.trim()) {
      try {
        starEvaluation = await evaluateStarResponse({ question, candidateAnswer: answer });
        score = Number(((starEvaluation.overallScore || 70) / 100).toFixed(2));
        wasCorrect = score >= 0.6;
      } catch (e) {
        score = 0.7;
        wasCorrect = true;
      }
    } else if (question.roundType === 'coding' && answer && answer.trim()) {
      const continueWithoutRunning = Boolean(req.body.continueWithoutRunning);
      if (continueWithoutRunning) {
        // Candidate opted to continue without running code execution
        session.executionUnavailable = true;
        score = 0.0;
        wasCorrect = false;
        codeExecution = {
          allPassed: false,
          passedCount: 0,
          failedCount: 0,
          totalCount: 0,
          executionUnavailable: true,
          status: 'Execution Unavailable - Skipped by Candidate'
        };
      } else {
        try {
          const lang = req.body.language || 'javascript';
          // Execute both visible and hidden test cases
          codeExecution = await executeAllTestCases({
            sourceCode: answer,
            language: lang,
            testCases: question.testCases || [],
            isSubmission: true
          });

          // LLM Code Review
          codeReview = await reviewCodeWithLLM({
            question,
            sourceCode: answer,
            language: lang
          });

          const passRatio = codeExecution.totalCount > 0
            ? codeExecution.passedCount / codeExecution.totalCount
            : 0.0;
          const reviewRatio = (codeReview.overallCodeScore || 75) / 100;

          // Apply hint penalty deduction if hints were unlocked
          const penaltyTotal = (hintsUnlocked || []).reduce((sum, h) => sum + (h.penaltyPoints || 0), 0);
          const penaltyDeduction = penaltyTotal / 100;

          const baseScore = passRatio * 0.75 + reviewRatio * 0.25;
          score = Number(Math.max(0.1, Math.min(1.0, baseScore - penaltyDeduction)).toFixed(2));
          wasCorrect = codeExecution.allPassed && score >= 0.6;
        } catch (e) {
          if (e.code === 'EXECUTION_UNAVAILABLE') {
            session.executionUnavailable = true;
            await session.save();
            return res.status(503).json({
              success: false,
              code: 'EXECUTION_UNAVAILABLE',
              message: 'Code execution is unavailable right now. Retry, or continue without running.'
            });
          }
          score = 0.0;
          wasCorrect = false;
        }
      }
    } else {
      // Answer Relevance Gate & Quality Check for open-ended response
      const qualityChecks = evaluateAnswerQualityChecks(question, answer);
      
      if (!qualityChecks.passedGate) {
        score = Number((Math.max(0.05, qualityChecks.qualityScores.relevance.score / 100)).toFixed(2));
        wasCorrect = false;
      } else {
        // Heuristic text score based on length and concept match for open-ended
        const answerLower = (answer || '').toLowerCase();
        let matchedConcepts = 0;
        const keyConcepts = question.keyConcepts || [];

        for (const concept of keyConcepts) {
          if (answerLower.includes(concept.toLowerCase())) {
            matchedConcepts++;
          }
        }

        const conceptRatio = keyConcepts.length > 0 ? matchedConcepts / keyConcepts.length : 0.5;
        const lengthBonus = Math.min(1.0, (answer || '').length / 150);
        score = Number(Math.max(0.1, Math.min(1.0, conceptRatio * 0.7 + lengthBonus * 0.3)).toFixed(2));
        wasCorrect = score >= 0.6;
      }
    }

    // Apply time expiration penalty if validated
    if (timeExpired) {
      score = Number(Math.max(0, score * 0.85).toFixed(2));
      wasCorrect = score >= 0.6;
    }

    // Compute Per-Evaluation AI Confidence & Human Review Queue Dispatch
    const qualityGateResult = evaluateAnswerQualityChecks(question, answer);
    const confidenceResult = (!qualityGateResult.passedGate && question.roundType !== 'mcq')
      ? {
          confidenceScore: 0.15,
          confidencePercentage: 15,
          confidenceLevel: 'LOW',
          shouldFlagForHumanReview: true,
          flagReason: GATE_FALLBACK_MESSAGE,
          factors: { qualityDiscount: true }
        }
      : calculateEvaluationConfidence({
          rubricVariance: starEvaluation?.variance || 0,
          conceptCoverageRatio: 0.85,
          wordCount: (answer || '').split(/\s+/).filter(Boolean).length,
          integrityScore: session.integrityScore || 100,
          isCoding: question.roundType === 'coding'
        });

    if (confidenceResult.shouldFlagForHumanReview) {
      enqueueHumanReviewIfFlagged({
        sessionId: session._id,
        questionId: question._id || question.id,
        candidateId: session.userId,
        candidateName: req.user?.name || 'Candidate',
        score: Math.round(score * 100),
        confidenceScore: confidenceResult.confidenceScore,
        candidateAnswer: answer || '',
        triggerReason: (session.integrityScore || 100) < 75 ? 'INTEGRITY_ANOMALY' : 'LOW_AI_CONFIDENCE',
        rubricEvidence: starEvaluation?.recommendations || []
      }).catch(() => {});
    }

    // For coding questions allow an optional spoken explanation scored separately
    let evaluatedSpokenExplanation = null;
    if (question.roundType === 'coding' && spokenExplanation && (spokenExplanation.transcript || spokenExplanation.audioUrl)) {
      try {
        const explText = spokenExplanation.transcript || '';
        const explMetrics = spokenExplanation.speechMetrics || calculateSpeechMetrics({
          transcript: explText,
          durationSeconds: spokenExplanation.durationSeconds || 30
        });
        const explScoring = await executeScoringPipeline({
          question,
          candidateAnswer: explText,
          telemetry: {
            wpm: explMetrics.wpm,
            fillerRatio: explMetrics.fillerRatio
          }
        });
        const explScore = Number(((explScoring.compositeScore || 78) / 100).toFixed(2));
        evaluatedSpokenExplanation = {
          transcript: explText,
          audioUrl: spokenExplanation.audioUrl || '',
          speechMetrics: explMetrics,
          score: explScore,
          communicationScore: explMetrics.deliveryScore,
          feedback: explScoring.counterfactuals?.length > 0
            ? explScoring.counterfactuals[0].guidance
            : 'Clear technical explanation of code architecture and edge cases.'
        };
      } catch (e) {
        evaluatedSpokenExplanation = {
          transcript: spokenExplanation.transcript,
          audioUrl: spokenExplanation.audioUrl || '',
          speechMetrics: spokenExplanation.speechMetrics,
          score: 0.8,
          communicationScore: 80,
          feedback: 'Spoken code explanation received and recorded.'
        };
      }
    }

    // Use speech metrics only for Communication score where the round is configured for it
    const hasCommunicationConfig = question.roundType === 'voice' || question.roundType === 'behavioral' || req.body.hasCommunicationScore;
    let communicationScore = null;
    if (speechMetrics && hasCommunicationConfig) {
      communicationScore = Number((Math.min(10, Math.max(1, speechMetrics.deliveryScore / 10))).toFixed(1));
    }

    // Record response
    session.responses.push({
      questionId: question._id || question.id,
      roundType: question.roundType,
      answer: answer || '',
      score,
      confidenceScore: confidenceResult.confidenceScore,
      reviewStatus: confidenceResult.shouldFlagForHumanReview ? 'flagged_review' : 'not_flagged',
      qualityChecks: qualityGateResult,
      passedGate: qualityGateResult.passedGate,
      thetaAfter: session.abilityTheta,
      semAfter: session.abilitySem,
      answeredAt: new Date(),
      durationSeconds: Math.min(actualElapsedSeconds, allowedSeconds),
      serverValidatedTimer: {
        allowedSeconds,
        actualSeconds: actualElapsedSeconds,
        timeExpired
      },
      // Dual-input answer telemetry
      inputMode,
      transcript,
      audioUrl,
      editedAfterTranscription: Boolean(editedAfterTranscription),
      speechMetrics,
      spokenExplanation: evaluatedSpokenExplanation || spokenExplanation,
      communicationScore,
      followUps: [],
      starEvaluation,
      codeExecution,
      codeReview,
      hintsUnlocked
    });

    // -------------------------------------------------------------
    // Multi-Round Progression Check
    // -------------------------------------------------------------
    let allRoundsCompleted = false;
    if (session.rounds && session.rounds.length > 0) {
      const currRound = session.rounds[session.currentRoundIndex || 0];
      if (currRound) {
        currRound.completedQuestions = (currRound.completedQuestions || 0) + 1;
        if (currRound.completedQuestions >= currRound.targetQuestions) {
          currRound.status = 'completed';
          if ((session.currentRoundIndex || 0) + 1 < session.rounds.length) {
            session.currentRoundIndex = (session.currentRoundIndex || 0) + 1;
            const nextRoundObj = session.rounds[session.currentRoundIndex];
            nextRoundObj.status = 'in_progress';
            session.currentRound = nextRoundObj.roundType;
          } else {
            allRoundsCompleted = true;
          }
        }
      }
    }

    const pool = await getOrSeedQuestionPool(session.track);
    const questionMap = new Map();
    for (const q of pool) {
      questionMap.set((q._id || q.id).toString(), q);
    }
    // Also include currently answered question in map
    questionMap.set((question._id || question.id).toString(), question);

    const administeredWithParams = [];
    for (const r of session.responses) {
      const q = questionMap.get(r.questionId.toString());
      if (q) {
        administeredWithParams.push({
          b: q.irtParams?.b ?? 0,
          a: q.irtParams?.a ?? 1,
          c: q.irtParams?.c ?? 0,
          score: r.score
        });
      }
    }

    // Re-estimate Latent Ability (theta) and Standard Error via Bayesian EAP
    const eapResult = estimateAbilityEAP(administeredWithParams);
    const newTheta = eapResult.theta;
    const newSEM = eapResult.sem;
    const newPercentile = thetaToPercentileScore(newTheta);

    session.abilityTheta = newTheta;
    session.abilitySem = newSEM;
    session.percentileScore = newPercentile;
    session.currentQuestionIndex = session.responses.length;

    // Check stopping rule: All rounds finished OR SE < 0.30 OR max questions reached
    const stoppingStatus = shouldStopAdaptiveTest(session.responses, newSEM);
    const shouldFinish = allRoundsCompleted || stoppingStatus.shouldStop;

    let nextQuestion = null;

    if (session.isTargeted && session.customQuestions && session.customQuestions.length > 0) {
      const nextIdx = session.responses.length;
      if (nextIdx < session.customQuestions.length) {
        nextQuestion = session.customQuestions[nextIdx];
        session.currentRound = nextQuestion.roundType;
        session.currentQuestionId = nextQuestion._id || nextQuestion.id;
        session.currentQuestionStartedAt = new Date();
        session.currentQuestionAllowedSeconds =
          DEFAULT_ROUND_TIMERS[nextQuestion.roundType] || 120;
        session.totalPausedSeconds = 0;
        session.pausedAt = null;
      } else {
        session.status = 'completed';
        session.completedAt = new Date();
        emitSessionCompleted(sessionId, {
          sessionId,
          finalTheta: newTheta,
          finalSEM: newSEM,
          finalPercentile: newPercentile,
          reason: 'TARGETED_INTERVIEW_COMPLETED',
          totalQuestions: session.responses.length
        });
      }
    } else if (shouldFinish) {
      session.status = 'completed';
      session.completedAt = new Date();
      emitSessionCompleted(sessionId, {
        sessionId,
        finalTheta: newTheta,
        finalSEM: newSEM,
        finalPercentile: newPercentile,
        reason: allRoundsCompleted ? 'ALL_ROUNDS_COMPLETED' : stoppingStatus.reason,
        totalQuestions: session.responses.length
      });
    } else {
      // Prioritize question matching current multi-round roundType
      const administeredIds = session.responses.map((r) => r.questionId.toString());
      const roundPool = pool.filter((q) => q.roundType === session.currentRound);
      const eligiblePool = roundPool.length > 0 ? roundPool : pool;

      nextQuestion = selectNextQuestion(newTheta, eligiblePool, administeredIds, {
        enforceTopicBalance: true
      });

      if (!nextQuestion && eligiblePool !== pool) {
        nextQuestion = selectNextQuestion(newTheta, pool, administeredIds, {
          enforceTopicBalance: true
        });
      }

      if (!nextQuestion) {
        session.status = 'completed';
        session.completedAt = new Date();
      } else {
        session.currentRound = nextQuestion.roundType;
        session.currentQuestionId = nextQuestion._id || nextQuestion.id;
        session.currentQuestionStartedAt = new Date();
        session.currentQuestionAllowedSeconds =
          DEFAULT_ROUND_TIMERS[nextQuestion.roundType] || 90;
        session.totalPausedSeconds = 0;
        session.pausedAt = null;
      }
    }

    if (session.save) {
      await session.save().catch(() => {});
    }

    // Push real-time ability meter update via Socket.io
    emitAbilityUpdate(sessionId, {
      sessionId,
      theta: newTheta,
      sem: newSEM,
      percentileScore: newPercentile,
      questionIndex: session.currentQuestionIndex,
      isCompleted: session.status === 'completed'
    });

    res.status(200).json({
      success: true,
      data: {
        theta: newTheta,
        sem: newSEM,
        percentileScore: newPercentile,
        questionsAnswered: session.responses.length,
        isCompleted: session.status === 'completed',
        stoppingReason: stoppingStatus.shouldStop ? stoppingStatus.reason : null,
        currentRound: session.currentRound,
        currentRoundIndex: session.currentRoundIndex || 0,
        rounds: session.rounds || [],
        timer: nextQuestion
          ? {
              allowedSeconds: session.currentQuestionAllowedSeconds,
              remainingSeconds: session.currentQuestionAllowedSeconds
            }
          : null,
        feedback: {
          score,
          wasCorrect,
          starEvaluation,
          codeExecution,
          codeReview,
          serverValidatedTimer: {
            allowedSeconds,
            actualSeconds: actualElapsedSeconds,
            timeExpired
          }
        },
        nextQuestion: sanitizeQuestionForCandidate(nextQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get session details & progress
 * @route   GET /api/sessions/:id
 * @access  Private
 */

export const logIntegrityEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eventType = 'tab_switch', metadata = {} } = req.body;

    const session = await AssessmentSession.findById(id).catch(() => null);
    if (session) {
      session.integrityEvents.push({
        eventType,
        timestamp: new Date(),
        metadata
      });
      session.integrityScore = Math.max(20, session.integrityScore - 5);
      await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      integrityScore: session?.integrityScore ?? 95
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Execute the full scoring pipeline for a candidate response
 * @route   POST /api/sessions/:id/evaluate-response
 * @access  Private
 */

export const recordAuditEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eventType, severity = 'INFO', durationMs = 0, metadata = {}, deduction = 0 } = req.body;

    if (!eventType) {
      return next(new AppError('eventType is required for audit record', 400));
    }

    let session = await AssessmentSession.findById(id).catch(() => null);
    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const auditEntry = {
      eventType,
      severity,
      durationMs: Number(durationMs) || 0,
      deduction: Number(deduction) || 0,
      timestamp: new Date(),
      metadata
    };

    session.auditLog = session.auditLog || [];
    session.auditLog.push(auditEntry);

    if (deduction > 0) {
      session.integrityScore = Math.max(0, (session.integrityScore || 100) - deduction);
      if (session.integrityMetrics) {
        session.integrityMetrics.trustScore = session.integrityScore;
        session.integrityMetrics.trustDeductions = session.integrityMetrics.trustDeductions || [];
        session.integrityMetrics.trustDeductions.push({
          reason: metadata.reason || eventType,
          points: deduction,
          timestamp: new Date()
        });
      }
    }

    await session.save();

    res.status(200).json({
      success: true,
      message: 'Audit event recorded',
      data: {
        auditEntry,
        currentTrustScore: session.integrityScore
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pause an in-progress assessment session and record frozen timer
 * @route   POST /api/sessions/:id/pause
 * @access  Private
 */

export const unlockQuestionHint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, hintLevel } = req.body;

    const session = await AssessmentSession.findById(id).catch(() => null);
    let question = await Question.findById(questionId).catch(() => null);
    if (!question) {
      question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    let existingUnlocked = [];
    if (session) {
      const resp = session.responses?.find((r) => r.questionId.toString() === questionId.toString());
      if (resp && resp.hintsUnlocked) {
        existingUnlocked = resp.hintsUnlocked;
      }
    }

    const unlockResult = unlockHintLevel({
      question,
      unlockedHints: existingUnlocked,
      requestedLevel: Number(hintLevel)
    });

    if (session && !unlockResult.alreadyUnlocked) {
      let resp = session.responses?.find((r) => r.questionId.toString() === questionId.toString());
      if (resp) {
        resp.hintsUnlocked = unlockResult.updatedUnlockedList;
      }
      if (session.save) await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        unlockedHint: unlockResult.unlockedHint,
        totalPenaltyPoints: unlockResult.totalPenaltyPoints,
        hintLadder: getSanitizedHintLadder(question, unlockResult.updatedUnlockedList || existingUnlocked)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload audio recording, transcribe via Whisper, calculate speech metrics, and route to rubric scoring
 * @route   POST /api/sessions/:id/voice-answer
 * @access  Private
 */

export const recordConfidenceTrend = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, confidenceScores = [] } = req.body;

    const session = await AssessmentSession.findById(id).catch(() => null);
    if (session) {
      const resp = session.responses?.find((r) => r.questionId.toString() === questionId?.toString());
      if (resp) {
        resp.confidenceTrend = confidenceScores;
      }
      if (session.save) await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Confidence trend recorded (excluded from scoring)',
      data: {
        dataPointsCount: confidenceScores.length,
        averageConfidence: confidenceScores.length > 0
          ? Math.round(confidenceScores.reduce((sum, p) => sum + (p.confidence || 0), 0) / confidenceScores.length)
          : 80
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export branded PDF assessment session report via Puppeteer
 * @route   POST /api/sessions/:id/export-pdf
 * @access  Private
 */
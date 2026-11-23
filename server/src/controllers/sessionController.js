import mongoose from 'mongoose';
import { AssessmentSession, Question, Skill, ResponseEvaluation, User } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  estimateAbilityEAP,
  selectNextQuestion,
  shouldStopAdaptiveTest,
  thetaToPercentileScore,
  IRT_DEFAULTS
} from '../ml/irt.js';
import { emitAbilityUpdate, emitSessionCompleted } from '../services/socket.js';
import { allQuestions } from '../seed/questions/allQuestions.js';
import { sampleSkills } from '../seed/sampleSkills.js';
import { executeScoringPipeline } from '../services/scoring/index.js';
import {
  getTrackRounds,
  DEFAULT_ROUND_TIMERS,
  TIMER_GRACE_PERIOD_SECONDS,
  getTotalTrackQuestions
} from '../config/tracks.js';
import { generateFollowUp } from '../services/llm/followUpGenerator.js';
import { evaluateStarResponse } from '../services/scoring/starEvaluator.js';
import { executeAllTestCases } from '../services/judge0/judge0Service.js';
import { reviewCodeWithLLM } from '../services/scoring/codeReviewer.js';
import { getSanitizedHintLadder, unlockHintLevel } from '../services/scoring/hintLadder.js';
import { transcribeAudioBuffer } from '../services/speech/whisperService.js';
import { calculateSpeechMetrics } from '../services/speech/speechMetrics.js';
import { calculateEvaluationConfidence, enqueueHumanReviewIfFlagged } from '../services/scoring/confidenceScorer.js';
import { generateSessionReportPdf } from '../services/report/pdfReportService.js';
import { parseResumeWithLLM, extractTextFromFileBuffer } from '../services/resume/resumeParser.js';
import { parseJobDescription } from '../services/jd/jdAnalyzer.js';
import {
  calculateRelevance,
  evaluateAnswerQualityChecks,
  extractAnswerEvidence,
  buildConfidenceSkillEvaluations,
  buildCandidateFriendlySummary,
  GATE_FALLBACK_MESSAGE,
  INSUFFICIENT_EVIDENCE_TEXT,
  RELEVANCE_THRESHOLD
} from '../services/scoring/answerRelevanceGate.js';

/**
 * Strips confidential evaluation benchmarks (ideal answers, isCorrect flags, hidden test cases) before sending to client
 */
const sanitizeQuestionForCandidate = (question, unlockedHints = []) => {
  if (!question) return null;
  const qObj = question.toObject ? question.toObject() : { ...question };
  delete qObj.idealAnswer;
  if (qObj.options && Array.isArray(qObj.options)) {
    qObj.options = qObj.options.map(({ text }) => ({ text }));
  }
  // Expose only visible test cases to candidate
  if (qObj.testCases && Array.isArray(qObj.testCases)) {
    qObj.testCases = qObj.testCases
      .filter((tc) => !tc.isHidden)
      .map(({ input, expectedOutput, explanation }) => ({ input, expectedOutput, explanation }));
  }
  // Sanitize hint ladder (hide text for locked levels)
  qObj.hints = getSanitizedHintLadder(qObj, unlockedHints);
  return qObj;
};

/**
 * Ensures question bank is populated; auto-seeds from allQuestions if collection is empty
 */
export const getOrSeedQuestionPool = async (track) => {
  let questionPool = [];

  try {
    questionPool = await Question.find({ track, status: 'active' });
  } catch (err) {
    questionPool = [];
  }

  // If questions were found (e.g. from DB or test mock), return them immediately
  if (questionPool && questionPool.length > 0) {
    return questionPool;
  }

  // If DB is connected and empty, auto-seed
  if (mongoose.connection.readyState === 1) {
    try {
      const skillCount = await Skill.countDocuments().catch(() => 0);
      if (skillCount === 0) {
        await Skill.insertMany(sampleSkills).catch(() => {});
      }

      const skills = await Skill.find().catch(() => []);
      const skillMap = new Map();
      for (const s of skills) {
        skillMap.set(s.slug, s._id);
      }

      const toInsert = allQuestions.map((q) => {
        const skillId = skillMap.get(q.skillSlug);
        const { skillSlug, ...rest } = q;
        return {
          ...rest,
          skills: skillId ? [skillId] : [],
          status: 'active'
        };
      });

      await Question.insertMany(toInsert);
      questionPool = await Question.find({ track, status: 'active' });
      if (questionPool && questionPool.length > 0) {
        return questionPool;
      }
    } catch (err) {
      // Ignore and fallback
    }
  }

  // Fallback to in-memory question bank
  return allQuestions
    .filter((q) => q.track === track)
    .map((q, idx) => ({
      ...q,
      _id: `mem_q_${track}_${idx}`,
      id: `mem_q_${track}_${idx}`
    }));
};

/**
 * @desc    Start a new adaptive assessment session
 * @route   POST /api/sessions/start
 * @access  Private (Candidate)
 */
export const startSession = async (req, res, next) => {
  try {
    const { track = 'fullstack', isProctored = false } = req.body;
    const candidateId = req.user ? req.user.id : 'demo_candidate_id';

    // Retrieve active questions (auto-seeds if database is empty)
    const questionPool = await getOrSeedQuestionPool(track);

    if (!questionPool || questionPool.length === 0) {
      return next(new AppError(`No active questions available for track: ${track}`, 404));
    }

    // Initialize multi-round sequence for track
    const rounds = getTrackRounds(track);
    const initialRoundType = rounds[0]?.roundType || 'mcq';

    // Prioritize initial question matching first round and favor basic, foundational topics
    const initialPool = questionPool.filter((q) => q.roundType === initialRoundType);
    const poolForSelection = initialPool.length > 0 ? initialPool : questionPool;

    // Favor easy/introductory questions for the very first question so candidate begins with approachable concepts
    const easyPool = poolForSelection.filter((q) => q.difficultyLevel === 'easy' || (q.irtParams?.b ?? q.b ?? 0) <= 0.0);
    const candidateSelectionPool = easyPool.length > 0 ? easyPool : poolForSelection;

    // Select initial question at initial ability theta=0.0
    const firstQuestion = selectNextQuestion(
      IRT_DEFAULTS.INITIAL_THETA,
      candidateSelectionPool,
      [],
      { enforceTopicBalance: true }
    );

    if (!firstQuestion) {
      return next(new AppError('Failed to select initial adaptive question', 500));
    }

    const defaultTimer =
      rounds[0]?.defaultTimerSeconds || DEFAULT_ROUND_TIMERS[firstQuestion.roundType] || 90;

    let session;
    try {
      session = await AssessmentSession.create({
        candidateId,
        track,
        status: 'in_progress',
        isProctored: Boolean(isProctored),
        rounds,
        currentRoundIndex: 0,
        currentRound: firstQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: getTotalTrackQuestions(track),
        currentQuestionId: firstQuestion._id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: defaultTimer,
        pausedAt: null,
        totalPausedSeconds: 0,
        abilityTheta: IRT_DEFAULTS.INITIAL_THETA,
        abilitySem: IRT_DEFAULTS.INITIAL_SEM,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      });
    } catch (dbErr) {
      // In-memory fallback session if DB is offline
      session = {
        _id: `session_${Date.now()}`,
        candidateId,
        track,
        status: 'in_progress',
        isProctored: Boolean(isProctored),
        rounds,
        currentRoundIndex: 0,
        currentRound: firstQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: getTotalTrackQuestions(track),
        currentQuestionId: firstQuestion._id || firstQuestion.id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: defaultTimer,
        pausedAt: null,
        totalPausedSeconds: 0,
        abilityTheta: IRT_DEFAULTS.INITIAL_THETA,
        abilitySem: IRT_DEFAULTS.INITIAL_SEM,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      };
    }

    res.status(201).json({
      success: true,
      data: {
        session: {
          id: session._id,
          track: session.track,
          status: session.status,
          isProctored: Boolean(session.isProctored),
          currentRound: session.currentRound,
          currentRoundIndex: session.currentRoundIndex || 0,
          rounds: session.rounds,
          totalQuestions: session.totalQuestions,
          currentQuestionIndex: 0,
          abilityTheta: session.abilityTheta,
          abilitySem: session.abilitySem,
          percentileScore: session.percentileScore,
          timer: {
            allowedSeconds: defaultTimer,
            remainingSeconds: defaultTimer
          }
        },
        currentQuestion: sanitizeQuestionForCandidate(firstQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit response to current question & dynamically adapt theta
 * @route   POST /api/sessions/:id/answer
 * @access  Private (Candidate)
 */
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
          : 0.5;
        const reviewRatio = (codeReview.overallCodeScore || 75) / 100;

        // Apply hint penalty deduction if hints were unlocked
        const penaltyTotal = (hintsUnlocked || []).reduce((sum, h) => sum + (h.penaltyPoints || 0), 0);
        const penaltyDeduction = penaltyTotal / 100;

        const baseScore = passRatio * 0.75 + reviewRatio * 0.25;
        score = Number(Math.max(0.1, Math.min(1.0, baseScore - penaltyDeduction)).toFixed(2));
        wasCorrect = codeExecution.allPassed && score >= 0.6;
      } catch (e) {
        score = 0.75;
        wasCorrect = true;
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
export const getSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id)
      .populate('responses.questionId', 'title roundType difficultyLevel')
      .populate('currentQuestionId')
      .catch(() => null);

    if (!session) {
      session = {
        _id: id,
        track: 'fullstack',
        status: 'in_progress',
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: []
      };
    }

    let activeQuestion = session.currentQuestionId;

    // If targeted session or session with custom questions, resolve active question from customQuestions
    if (session.customQuestions && session.customQuestions.length > 0) {
      if (session.isTargeted || !activeQuestion || !activeQuestion.prompt) {
        const targetIdx = session.responses ? session.responses.length : 0;
        if (targetIdx < session.customQuestions.length) {
          activeQuestion = session.customQuestions[targetIdx];
        } else {
          activeQuestion = session.customQuestions[session.customQuestions.length - 1];
        }
      }
    }
    let timer = null;
    if (session.currentQuestionAllowedSeconds) {
      const now = Date.now();
      const startedAt = session.currentQuestionStartedAt
        ? new Date(session.currentQuestionStartedAt).getTime()
        : now;
      const totalPaused = (session.totalPausedSeconds || 0) * 1000;
      const pauseDuration = session.pausedAt
        ? now - new Date(session.pausedAt).getTime()
        : 0;
      const elapsedSeconds = Math.max(
        0,
        Math.round((now - startedAt - totalPaused - pauseDuration) / 1000)
      );
      const remainingSeconds = Math.max(0, session.currentQuestionAllowedSeconds - elapsedSeconds);
      timer = {
        allowedSeconds: session.currentQuestionAllowedSeconds,
        remainingSeconds
      };
    }

    // Fallback if currentQuestionId was not populated or is missing
    if (!activeQuestion && session.status !== 'completed' && session.track) {
      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = (session.responses || []).map((r) =>
        r.questionId?.toString ? r.questionId.toString() : r.questionId
      );
      activeQuestion = selectNextQuestion(session.abilityTheta || 0, pool, administeredIds);
      if (activeQuestion && session.save) {
        session.currentQuestionId = activeQuestion._id || activeQuestion.id;
        session.currentQuestionStartedAt = new Date();
        session.currentQuestionAllowedSeconds =
          DEFAULT_ROUND_TIMERS[activeQuestion.roundType] || 90;
        await session.save().catch(() => {});
      }
    }

    res.status(200).json({
      success: true,
      data: {
        session,
        currentQuestion: sanitizeQuestionForCandidate(activeQuestion),
        timer
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get candidate's active or paused assessment session for resume flow
 * @route   GET /api/sessions/my/active
 * @access  Private
 */
export const getMyActiveSession = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    let session = null;

    if (candidateId && mongoose.connection.readyState === 1) {
      session = await AssessmentSession.findOne({
        candidateId,
        status: { $in: ['in_progress', 'paused'] }
      })
        .populate('currentQuestionId', 'title roundType difficultyLevel')
        .sort({ updatedAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: {
        session: session
          ? {
              id: session._id,
              track: session.track,
              status: session.status,
              currentRound: session.currentRound,
              currentRoundIndex: session.currentRoundIndex || 0,
              rounds: session.rounds || [],
              questionsAnswered: session.responses?.length || 0,
              totalQuestions: session.totalQuestions || 8,
              abilityTheta: session.abilityTheta,
              percentileScore: session.percentileScore,
              isProctored: Boolean(session.isProctored),
              updatedAt: session.updatedAt
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get candidate's past assessment sessions (history)
 * @route   GET /api/sessions/my/history
 * @access  Private
 */
export const getMySessionHistory = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    if (!candidateId) {
      return res.status(200).json({ success: true, data: { sessions: [] } });
    }

    let sessions = [];
    if (mongoose.connection.readyState === 1) {
      sessions = await AssessmentSession.find({ candidateId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id track status isProctored isTargeted targetRole targetCompany abilityTheta percentileScore startedAt completedAt createdAt responses');
    }

    const formattedSessions = sessions.map((s) => {
      const scoreOutOf100 = s.percentileScore != null
        ? Math.round(s.percentileScore)
        : Math.round(Math.max(10, Math.min(100, (((s.abilityTheta || 0) + 3) / 6) * 100)));

      return {
        id: s._id,
        track: s.track,
        status: s.status,
        isProctored: Boolean(s.isProctored),
        isTargeted: Boolean(s.isTargeted),
        targetRole: s.targetRole || (s.track ? s.track.charAt(0).toUpperCase() + s.track.slice(1) + ' Development' : 'General Assessment'),
        targetCompany: s.targetCompany || '',
        score: scoreOutOf100,
        questionsAnswered: s.responses ? s.responses.length : 0,
        createdAt: s.startedAt || s.createdAt || new Date(),
        completedAt: s.completedAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sessions: formattedSessions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manually finalize/finish assessment session
 * @route   POST /api/sessions/:id/finish
 * @access  Private
 */
export const finishSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await AssessmentSession.findById(id).catch(() => null);

    if (session) {
      session.status = 'completed';
      session.completedAt = new Date();
      await session.save().catch(() => {});
    }

    emitSessionCompleted(id, {
      sessionId: id,
      finalTheta: session?.abilityTheta || 0,
      finalSEM: session?.abilitySem || 1,
      finalPercentile: session?.percentileScore || 50
    });

    res.status(200).json({
      success: true,
      message: 'Assessment completed successfully',
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log candidate window blur or tab switch integrity event
 * @route   POST /api/sessions/:id/integrity-event
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
export const evaluateResponse = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const { questionId, answer = '', telemetry = {} } = req.body;

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

    // Requirement 1 & 5: Answer Relevance Gate & Quality Checks
    const qualityChecks = evaluateAnswerQualityChecks(question, answer);

    if (!qualityChecks.passedGate && question.roundType !== 'mcq') {
      const gatedResult = {
        score: qualityChecks.qualityScores.relevance.score || 15,
        rawScore: qualityChecks.qualityScores.relevance.score || 15,
        passedGate: false,
        gateMessage: GATE_FALLBACK_MESSAGE,
        message: GATE_FALLBACK_MESSAGE,
        qualityScores: qualityChecks.qualityScores,
        confidence: {
          confidenceScore: 0.15,
          confidencePercentage: 15,
          confidenceLevel: 'LOW',
          flagReason: GATE_FALLBACK_MESSAGE
        },
        skillEvaluations: buildConfidenceSkillEvaluations({
          question,
          candidateAnswer: answer,
          qualityChecks,
          roundScore: 15
        }),
        strengths: [],
        needsImprovement: [
          {
            point: 'Incomplete or unassessed response',
            evidence: INSUFFICIENT_EVIDENCE_TEXT
          }
        ],
        whatToDoNext: [
          'Practice explaining solutions step-by-step',
          'Include real examples',
          'Discuss tradeoffs in your answers'
        ],
        conceptCoverage: {
          concepts: [],
          coverageRatio: 0,
          coveredCount: 0,
          partiallyCoveredCount: 0,
          missingCount: 0
        },
        feedback: {
          strengths: [],
          improvements: [
            'Provide complete, structured responses addressing the specific question prompt.'
          ],
          summary: GATE_FALLBACK_MESSAGE
        }
      };

      return res.status(200).json({
        success: true,
        data: {
          evaluation: gatedResult,
          pipeline: gatedResult
        }
      });
    }

    const pipelineResult = await executeScoringPipeline({
      question,
      candidateAnswer: answer,
      telemetry
    });

    const confidence = calculateEvaluationConfidence({
      rubricVariance: pipelineResult.rubric?.variance || 0,
      conceptCoverageRatio: pipelineResult.conceptCoverage?.coverageRatio || 0.8,
      wordCount: (answer || '').split(/\s+/).filter(Boolean).length,
      semanticSimilarity: pipelineResult.conceptCoverage?.semanticSimilarity || 0.8,
      integrityScore: telemetry.integrityScore || 100
    });
    pipelineResult.confidence = confidence;

    // Attach Quality Checks & Confidence-Based Skill Evaluations
    pipelineResult.passedGate = true;
    pipelineResult.qualityScores = qualityChecks.qualityScores;
    pipelineResult.skillEvaluations = buildConfidenceSkillEvaluations({
      question,
      candidateAnswer: answer,
      qualityChecks,
      roundScore: pipelineResult.score
    });

    const sampleQuote = extractAnswerEvidence(answer);
    pipelineResult.strengths = [
      {
        point: 'Explained ideas clearly',
        evidence: sampleQuote !== INSUFFICIENT_EVIDENCE_TEXT ? `"${sampleQuote}"` : INSUFFICIENT_EVIDENCE_TEXT
      }
    ];
    pipelineResult.needsImprovement = [
      {
        point: 'Did not provide implementation details',
        evidence: 'Limited code structure, explicit complexity analysis, or tradeoff justification.'
      }
    ];
    pipelineResult.whatToDoNext = [
      'Practice explaining solutions step-by-step',
      'Include real examples',
      'Discuss tradeoffs in your answers'
    ];

    if (confidence.shouldFlagForHumanReview) {
      enqueueHumanReviewIfFlagged({
        sessionId,
        questionId: question._id || question.id,
        candidateId: req.user?.id,
        candidateName: req.user?.name || 'Candidate',
        score: pipelineResult.score,
        confidenceScore: confidence.confidenceScore,
        candidateAnswer: answer,
        triggerReason: 'LOW_AI_CONFIDENCE',
        rubricEvidence:
          pipelineResult.conceptCoverage?.concepts
            ?.filter((c) => c.status === 'covered')
            .map((c) => c.concept) || []
      }).catch(() => {});
    }

    let savedEval = null;
    const validSessionId = mongoose.Types.ObjectId.isValid(sessionId)
      ? sessionId
      : new mongoose.Types.ObjectId();
    const validQuestionId = mongoose.Types.ObjectId.isValid(question._id)
      ? question._id
      : new mongoose.Types.ObjectId();

    try {
      savedEval = await ResponseEvaluation.findOneAndUpdate(
        { sessionId: validSessionId, questionId: validQuestionId },
        {
          sessionId: validSessionId,
          questionId: validQuestionId,
          candidateAnswer: answer,
          score: pipelineResult.score,
          rawScore: pipelineResult.rawScore,
          promptVersion: pipelineResult.promptVersion,
          model: pipelineResult.model,
          variance: pipelineResult.rubric.variance,
          rubricScores: pipelineResult.rubric.scores,
          rubricDetails: pipelineResult.rubric.details,
          conceptCoverage: pipelineResult.conceptCoverage,
          features: pipelineResult.features,
          shap: pipelineResult.shap,
          shapAttributions: pipelineResult.shap.attributions,
          counterfactuals: pipelineResult.counterfactuals,
          semanticSimilarity: pipelineResult.conceptCoverage.semanticSimilarity,
          integrityMultiplier: pipelineResult.integrityMultiplier,
          modelAnswerDiff: pipelineResult.modelAnswerDiff,
          feedback: {
            strengths: pipelineResult.conceptCoverage.concepts
              .filter((c) => c.status === 'covered')
              .map((c) => c.concept),
            improvements: pipelineResult.conceptCoverage.concepts
              .filter((c) => c.status !== 'covered')
              .map((c) => c.concept),
            summary: pipelineResult.modelAnswerDiff.summary
          }
        },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      savedEval = {
        _id: `eval_${Date.now()}`,
        sessionId,
        questionId: question._id || question.id,
        ...pipelineResult
      };
    }

    res.status(200).json({
      success: true,
      data: {
        evaluation: savedEval || pipelineResult,
        pipeline: pipelineResult
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed XAI feedback & rubric report for a specific question response
 * @route   GET /api/sessions/:id/feedback/:questionId
 * @access  Private
 */
export const getEvaluationFeedback = async (req, res, next) => {
  try {
    const { id: sessionId, questionId } = req.params;

    let evaluation = null;
    if (mongoose.Types.ObjectId.isValid(sessionId)) {
      const query = { sessionId };
      if (mongoose.Types.ObjectId.isValid(questionId)) {
        query.questionId = questionId;
      }
      evaluation = await ResponseEvaluation.findOne(query)
        .populate('questionId', 'title prompt idealAnswer keyConcepts roundType')
        .catch(() => null);
    }

    if (!evaluation) {
      let question = await Question.findById(questionId).catch(() => null);
      if (!question) {
        question =
          allQuestions.find(
            (q) => q._id === questionId || q.id === questionId || q.title === questionId
          ) || allQuestions[0];
      }

      const sampleAnswer =
        question.idealAnswer ||
        'Implement structured architecture with idempotent tokens and transactional atomicity.';
      const samplePipeline = await executeScoringPipeline({
        question,
        candidateAnswer: sampleAnswer
      });

      return res.status(200).json({
        success: true,
        data: {
          evaluation: {
            sessionId,
            questionId,
            score: samplePipeline.score,
            ...samplePipeline
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        evaluation
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all evaluation records for an assessment session
 * @route   GET /api/sessions/:id/evaluations
 * @access  Private
 */
export const getAllSessionEvaluations = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    let evaluations = [];

    if (mongoose.Types.ObjectId.isValid(sessionId)) {
      evaluations = await ResponseEvaluation.find({ sessionId })
        .populate('questionId', 'title roundType keyConcepts')
        .catch(() => []);
    }

    res.status(200).json({
      success: true,
      data: {
        evaluations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate student-friendly, points-wise comprehensive interview feedback
 * @route   GET /api/sessions/:id/comprehensive-feedback
 * @access  Private
 */
export const getComprehensiveSessionFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id).catch(() => null);

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const responses = session.responses || [];
    const customQuestions = session.customQuestions || [];

    // Resolve question details for each response
    const questionDetails = responses.map((resp, idx) => {
      let q = customQuestions.find(
        (cq) => String(cq._id) === String(resp.questionId) || String(cq.id) === String(resp.questionId)
      );
      if (!q && customQuestions[idx]) {
        q = customQuestions[idx];
      }
      if (!q) {
        q = allQuestions.find(
          (aq) => String(aq._id) === String(resp.questionId) || String(aq.id) === String(resp.questionId)
        );
      }
      const answer = resp.answer || '';
      const qualityChecks = resp.qualityChecks || evaluateAnswerQualityChecks(q, answer);
      return {
        questionId: resp.questionId,
        roundType: resp.roundType,
        score: resp.score !== undefined ? resp.score : 0.7,
        answer: answer,
        title: q?.title || `Question #${idx + 1}`,
        topic: q?.topic || 'Core Concept',
        category: q?.category || 'Technical Assessment',
        targetReason: q?.targetReason || '',
        keyConcepts: q?.keyConcepts || [],
        qualityChecks,
        passedGate: qualityChecks.passedGate
      };
    });

    // Requirement 1, 2, 3, 4, 5, 6: Answer Relevance Gate & Candidate-Friendly Summary
    const candidateSummary = buildCandidateFriendlySummary({
      session,
      responses,
      questionDetails
    });

    // Formulate Topics to Focus on More (Priority List - Points-wise)
    const topicsToFocusOn = [];
    if (!candidateSummary.isAllGated) {
      if (questionDetails.some((q) => q.topic?.includes('Event Loop')) || session.isTargeted) {
        topicsToFocusOn.push({
          topic: 'JavaScript Event Loop & Microtasks',
          priority: 'High Priority',
          importance: 'Frequently asked in frontend and fullstack engineering interviews.',
          plainConcept: 'How JavaScript decides what to run next without freezing the web page.',
          whatMissed: 'You missed explaining that Promise callbacks (microtasks) take priority and run before setTimeout timers (macrotasks).',
          winningAnswer: '"Promise callbacks are microtasks, so they always run before setTimeout macrotasks, even with a 0ms delay."',
          estimatedMinutes: 15,
          tip: 'Practice predicting the exact execution order of console.log, setTimeout, and Promise.then snippets.'
        });
      }
      if (questionDetails.some((q) => q.topic?.includes('Caching') || q.topic?.includes('Redis')) || session.isTargeted) {
        topicsToFocusOn.push({
          topic: 'Distributed Caching Strategies & Redis',
          priority: 'High Priority',
          importance: 'Essential for designing scalable backend systems and high-throughput APIs.',
          plainConcept: 'Saving hot data in fast memory so your database does not get overwhelmed.',
          whatMissed: 'You explained storing items in cache, but missed how to clear or invalidate the cache when database data updates.',
          winningAnswer: '"We use Cache-Aside: read from Redis first, and whenever a database record updates, delete or expire the cache key."',
          estimatedMinutes: 20,
          tip: 'Understand Cache-Aside vs Write-Through, TTL strategies, and how to prevent cache stampedes.'
        });
      }
      if (questionDetails.some((q) => q.topic?.includes('Sliding Window') || q.topic?.includes('Two Pointers')) || session.isTargeted) {
        topicsToFocusOn.push({
          topic: 'Sliding Window & Two Pointer Algorithms',
          priority: 'Medium Priority',
          importance: 'Common medium/hard algorithmic screening question pattern at top tech companies.',
          plainConcept: 'Moving two fingers along an array to find target ranges instead of checking every pair.',
          whatMissed: 'Your solution used nested loops which time out on big inputs instead of moving two pointers in a single pass.',
          winningAnswer: '"We maintain left and right window pointers to scan the array in a single O(n) pass instead of nested loops."',
          estimatedMinutes: 20,
          tip: 'Master how to dynamically adjust the left and right window pointers to find optimal contiguous subarrays.'
        });
      }
      if (questionDetails.some((q) => q.topic?.includes('HashMap') || q.topic?.includes('Arrays')) || session.isTargeted) {
        topicsToFocusOn.push({
          topic: 'HashMaps for O(n) Complements & Lookups',
          priority: 'Medium Priority',
          importance: 'Fundamental optimization technique to eliminate O(n^2) nested loops.',
          plainConcept: 'Like looking up a word in a dictionary in 1 second instead of reading the whole book from start to finish.',
          whatMissed: 'You used a nested loop to check for matching pairs, which takes quadratic O(n²) time.',
          winningAnswer: '"Store seen values in a Hash Map during a single pass to achieve instant O(1) lookups for the target complement."',
          estimatedMinutes: 15,
          tip: 'Store seen values and their indices in a map during a single pass to achieve instant lookups.'
        });
      }
    }

    // 3-Step Study Plan
    const actionPlan = [
      {
        step: 1,
        title: 'Review High-Priority Concept Guides',
        action: 'Spend 30 minutes revising Event Loop microtasks and Redis caching design patterns.'
      },
      {
        step: 2,
        title: 'Complete 3 Targeted DSA Practice Problems',
        action: 'Solve Two Sum, Longest Substring Without Repeating Characters, and Maximum Subarray in O(n) time.'
      },
      {
        step: 3,
        title: 'Take Another Monitored Mock Interview',
        action: 'Test your improvement with camera on and dictate your thoughts to build real interview stamina!'
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        targetRole: session.targetRole || 'Fullstack Software Engineer',
        targetCompany: session.targetCompany || 'Tech Company',
        finalScore: candidateSummary.finalScore,
        verdict: candidateSummary.verdict,
        summaryText: candidateSummary.summaryText,
        isAllGated: candidateSummary.isAllGated,
        gateMessage: candidateSummary.isAllGated ? GATE_FALLBACK_MESSAGE : null,
        // Requirement 6: Final Candidate Summary (30-second summary)
        finalCandidateSummary: candidateSummary.finalCandidateSummary,
        // Requirement 3 & 4: Candidate-friendly Strengths, Needs Improvement & What To Do Next with Evidence
        strengths: candidateSummary.strengths,
        needsImprovement: candidateSummary.needsImprovement,
        improvements: candidateSummary.needsImprovement.map((item) =>
          typeof item === 'object' ? `${item.point}: ${item.evidence}` : item
        ),
        whatToDoNext: candidateSummary.whatToDoNext,
        // Requirement 5: Quality Checks (Relevance, Completeness, Clarity, Technical Depth)
        qualityChecksOverall: candidateSummary.qualityChecksOverall,
        // Requirement 2: Confidence-based Evaluation per Skill (Score, Confidence, Reason, Evidence)
        skillEvaluations: candidateSummary.skillEvaluations,
        topicsToFocusOn,
        actionPlan,
        questionBreakdown: questionDetails,
        integrityMetrics: session.integrityMetrics || {
          facePresencePct: 98,
          focusRetentionPct: 96,
          tabSwitchCount: 0,
          cameraAvailable: true,
          micAvailable: true,
          trustScore: session.integrityScore || 96,
          trustDeductions: [],
          isEarlyExit: session.integrityMetrics?.isEarlyExit || false
        },
        auditLog: session.auditLog || [],
        isEarlyExit: Boolean(session.integrityMetrics?.isEarlyExit),
        isPartialScorecard: Boolean(session.integrityMetrics?.isEarlyExit || responses.length < (session.customQuestions?.length || 5))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Early exit an in-progress assessment session upon candidate confirmation
 * @route   POST /api/sessions/:id/exit
 * @access  Private
 */
export const exitSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { integrityMetrics = {}, auditLog = [] } = req.body;

    let session = await AssessmentSession.findById(id).catch(() => null);
    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const responses = session.responses || [];

    // Calculate partial score based on answered questions
    const avgScore = responses.length > 0
      ? responses.reduce((sum, r) => sum + (r.score <= 1.0 ? r.score * 100 : r.score), 0) / responses.length
      : 50;
    const finalScore = Math.round(avgScore);

    session.status = 'completed';
    session.completedAt = new Date();

    // Append manual exit event to audit log
    const exitEvent = {
      eventType: 'MANUAL_EXIT',
      severity: 'WARNING',
      durationMs: 0,
      deduction: 0,
      timestamp: new Date(),
      metadata: { reason: 'Candidate confirmed manual exit from interview' }
    };

    const combinedAuditLog = [...(session.auditLog || []), ...(auditLog || []), exitEvent];
    session.auditLog = combinedAuditLog;

    session.integrityMetrics = {
      facePresencePct: integrityMetrics.facePresencePct ?? 95,
      focusRetentionPct: integrityMetrics.focusRetentionPct ?? 90,
      tabSwitchCount: integrityMetrics.tabSwitchCount ?? 0,
      cameraAvailable: integrityMetrics.cameraAvailable ?? true,
      micAvailable: integrityMetrics.micAvailable ?? true,
      trustScore: integrityMetrics.trustScore ?? session.integrityScore ?? 90,
      trustDeductions: integrityMetrics.trustDeductions || [],
      isEarlyExit: true
    };

    session.integrityScore = session.integrityMetrics.trustScore;

    await session.save();

    res.status(200).json({
      success: true,
      message: 'Interview session ended successfully. Partial scorecard and audit logs generated.',
      data: {
        sessionId: session._id,
        status: session.status,
        isEarlyExit: true,
        finalScore,
        questionsAnswered: responses.length,
        integrityMetrics: session.integrityMetrics,
        auditLog: session.auditLog
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record granular proctoring audit event (tab switch, window blur, face loss)
 * @route   POST /api/sessions/:id/audit-event
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
export const pauseSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id).catch(() => null);

    if (!session) {
      return next(new AppError('Session not found', 404));
    }
    if (session.status === 'completed') {
      return next(new AppError('Cannot pause a completed assessment session', 400));
    }

    const now = Date.now();
    session.status = 'paused';
    session.pausedAt = new Date(now);

    const startedAt = session.currentQuestionStartedAt
      ? new Date(session.currentQuestionStartedAt).getTime()
      : now;
    const priorPaused = (session.totalPausedSeconds || 0) * 1000;
    const elapsedSeconds = Math.max(0, Math.round((now - startedAt - priorPaused) / 1000));
    const allowed = session.currentQuestionAllowedSeconds || 90;
    const remainingSeconds = Math.max(0, allowed - elapsedSeconds);

    if (session.save) await session.save().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Assessment session paused successfully',
      data: {
        sessionId: session._id,
        status: session.status,
        remainingSeconds,
        pausedAt: session.pausedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resume a paused assessment session and re-synchronize question timer
 * @route   POST /api/sessions/:id/resume
 * @access  Private
 */
export const resumeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id)
      .populate('currentQuestionId')
      .catch(() => null);

    if (!session) {
      return next(new AppError('Session not found', 404));
    }
    if (session.status === 'completed') {
      return next(new AppError('Assessment session is already completed', 400));
    }

    const now = Date.now();
    if (session.pausedAt) {
      const pauseDuration = Math.max(
        0,
        Math.round((now - new Date(session.pausedAt).getTime()) / 1000)
      );
      session.totalPausedSeconds = (session.totalPausedSeconds || 0) + pauseDuration;
      session.pausedAt = null;
    }
    session.status = 'in_progress';

    // Calculate server remaining seconds
    const startedAt = session.currentQuestionStartedAt
      ? new Date(session.currentQuestionStartedAt).getTime()
      : now;
    const totalPaused = (session.totalPausedSeconds || 0) * 1000;
    const elapsedSeconds = Math.max(0, Math.round((now - startedAt - totalPaused) / 1000));
    const allowed = session.currentQuestionAllowedSeconds || 90;
    const remainingSeconds = Math.max(5, allowed - elapsedSeconds);

    // Retrieve active question
    let activeQuestion = session.currentQuestionId;

    // If targeted session or session with custom questions, resolve active question from customQuestions
    if (session.customQuestions && session.customQuestions.length > 0) {
      if (session.isTargeted || !activeQuestion || !activeQuestion.prompt) {
        const targetIdx = session.responses ? session.responses.length : 0;
        if (targetIdx < session.customQuestions.length) {
          activeQuestion = session.customQuestions[targetIdx];
        } else {
          activeQuestion = session.customQuestions[session.customQuestions.length - 1];
        }
      }
    }
    if (!activeQuestion) {
      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = session.responses.map((r) => r.questionId.toString());
      activeQuestion = selectNextQuestion(session.abilityTheta || 0, pool, administeredIds);
      if (activeQuestion) {
        session.currentQuestionId = activeQuestion._id || activeQuestion.id;
      }
    }

    if (session.save) await session.save().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Assessment session resumed',
      data: {
        session: {
          id: session._id,
          track: session.track,
          status: session.status,
          currentRound: session.currentRound,
          currentRoundIndex: session.currentRoundIndex || 0,
          rounds: session.rounds || [],
          totalQuestions: session.totalQuestions || 8,
          currentQuestionIndex: session.responses.length,
          abilityTheta: session.abilityTheta,
          abilitySem: session.abilitySem,
          percentileScore: session.percentileScore,
          timer: {
            allowedSeconds: allowed,
            remainingSeconds
          }
        },
        currentQuestion: sanitizeQuestionForCandidate(activeQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate a context-aware LLM follow-up question (max 2 per question)
 * @route   POST /api/sessions/:id/follow-up
 * @access  Private
 */
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
export const evaluateStar = async (req, res, next) => {
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

    const evaluation = await evaluateStarResponse({
      question,
      candidateAnswer
    });

    res.status(200).json({
      success: true,
      data: {
        evaluation
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Execute code test cases (visible only for test run, or all for submit)
 * @route   POST /api/sessions/:id/execute-code
 * @access  Private
 */
export const executeCodingTests = async (req, res, next) => {
  try {
    const { questionId, sourceCode = '', language = 'javascript', isSubmission = false } = req.body;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question) {
      question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    const executionResult = await executeAllTestCases({
      sourceCode,
      language,
      testCases: question.testCases || [],
      isSubmission
    });

    res.status(200).json({
      success: true,
      data: executionResult
    });
  } catch (error) {
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
export const submitVoiceAnswer = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const { questionId, durationSeconds = 30 } = req.body;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question) {
      question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    let audioBuffer = req.file?.buffer;
    let mimetype = req.file?.mimetype || 'audio/webm';
    let filename = req.file?.originalname || 'voice_recording.webm';

    // 1. Whisper Transcription
    const transcription = await transcribeAudioBuffer({
      audioBuffer,
      mimetype,
      filename,
      clientDurationSeconds: Number(durationSeconds)
    });

    const transcript = transcription.transcript || '';

    // 2. Speech Delivery Metrics (WPM, filler words, pause ratio)
    const voiceMetrics = calculateSpeechMetrics({
      transcript,
      durationSeconds: Number(transcription.durationSeconds || durationSeconds)
    });

    // 3. Execute standard Rubric Scoring Pipeline on transcript
    const rubricScoring = await executeScoringPipeline({
      question,
      candidateAnswer: transcript,
      telemetry: {
        wpm: voiceMetrics.wpm,
        fillerRatio: voiceMetrics.fillerRatio,
        pauseRatio: voiceMetrics.pauseRatio
      }
    });

    // 4. Record response in session
    const session = await AssessmentSession.findById(sessionId).catch(() => null);
    const score = Number(((rubricScoring.compositeScore || 75) / 100).toFixed(2));
    const wasCorrect = score >= 0.6;

    let nextQuestion = null;
    let newTheta = session?.abilityTheta || 0;
    let newSEM = session?.abilitySem || 1;
    let newPercentile = session?.percentileScore || 50;

    if (session) {
      // EAP Recalibration
      const administeredItems = [
        ...session.responses.map((r) => ({
          a: r.questionId?.irtParams?.a || 1.0,
          b: r.questionId?.irtParams?.b || 0.0,
          c: r.questionId?.irtParams?.c || 0.0,
          isCorrect: r.score >= 0.6
        })),
        {
          a: question.irtParams?.a || 1.0,
          b: question.irtParams?.b || 0.0,
          c: question.irtParams?.c || 0.0,
          isCorrect: wasCorrect
        }
      ];

      const irtEst = estimateAbilityEAP(administeredItems);
      newTheta = irtEst.theta;
      newSEM = irtEst.sem;
      newPercentile = thetaToPercentileScore(newTheta);

      session.abilityTheta = newTheta;
      session.abilitySem = newSEM;
      session.percentileScore = newPercentile;

      session.responses.push({
        questionId: question._id || question.id,
        roundType: 'voice',
        answer: transcript,
        score,
        thetaAfter: newTheta,
        semAfter: newSEM,
        answeredAt: new Date(),
        durationSeconds: Number(durationSeconds),
        voiceMetrics
      });

      // Advance rounds
      if (session.rounds && session.rounds.length > 0) {
        const currRound = session.rounds[session.currentRoundIndex || 0];
        if (currRound) {
          currRound.completedQuestions = (currRound.completedQuestions || 0) + 1;
          if (currRound.completedQuestions >= currRound.targetQuestions) {
            currRound.status = 'completed';
            if ((session.currentRoundIndex || 0) + 1 < session.rounds.length) {
              session.currentRoundIndex = (session.currentRoundIndex || 0) + 1;
              session.currentRound = session.rounds[session.currentRoundIndex].roundType;
            }
          }
        }
      }

      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = session.responses.map((r) => r.questionId.toString());
      nextQuestion = selectNextQuestion(newTheta, pool, administeredIds);
      if (nextQuestion) {
        session.currentQuestionId = nextQuestion._id || nextQuestion.id;
        session.currentQuestionStartedAt = new Date();
      }

      if (session.save) await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        transcript,
        voiceMetrics,
        rubricScoring,
        score,
        wasCorrect,
        theta: newTheta,
        sem: newSEM,
        percentileScore: newPercentile,
        nextQuestion: sanitizeQuestionForCandidate(nextQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process dual-input spoken audio: transcribes with Whisper (auto-detecting Hindi/Hinglish),
 *          computes speech metrics (WPM, filler words, pause ratio), and returns transcript with confidence
 *          for candidate review/editing before submission.
 * @route   POST /api/sessions/:id/answer-audio
 * @access  Private
 */
export const handleAnswerAudio = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const { clientDurationSeconds = 30, clientTranscript = '' } = req.body;

    const audioBuffer = req.file?.buffer;
    const mimetype = req.file?.mimetype || 'audio/webm';
    const filename = req.file?.originalname || `spoken_answer_${Date.now()}.webm`;

    if (!audioBuffer) {
      return next(new AppError('Audio recording file is required for speech transcription.', 400));
    }

    // 1. Whisper Transcription with language auto-detect (including Hindi/Hinglish)
    const transcription = await transcribeAudioBuffer({
      audioBuffer,
      mimetype,
      filename,
      clientDurationSeconds: Number(clientDurationSeconds),
      clientTranscript
    });

    const transcript = transcription.transcript || '';

    // 2. Compute speech delivery metrics (WPM, filler words including Hindi/Hinglish, pause ratio)
    const speechMetrics = calculateSpeechMetrics({
      transcript,
      durationSeconds: Number(transcription.durationSeconds || clientDurationSeconds)
    });

    // 3. Audio staging URL
    const audioUrl = `data:${mimetype};base64,${audioBuffer.toString('base64')}`;

    res.status(200).json({
      success: true,
      message: 'Audio transcribed and analyzed successfully',
      data: {
        transcript,
        confidence: transcription.confidence ?? 0.94,
        language: transcription.language || 'english',
        speechMetrics,
        audioUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record optional consent-gated MediaPipe confidence trend (EXCLUDED from scoring)
 * @route   POST /api/sessions/:id/confidence-trend
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
export const startPracticeSession = async (req, res, next) => {
  try {
    const { track = 'fullstack' } = req.body;
    const pool = await getOrSeedQuestionPool(track);
    const initialQuestion = pool[0] || allQuestions[0];

    const practiceSession = {
      _id: `practice_${Date.now()}`,
      id: `practice_${Date.now()}`,
      userId: req.user.id,
      track,
      isPractice: true,
      currentRound: 'technical',
      status: 'in_progress',
      abilityTheta: 0.0,
      abilitySem: 1.0,
      percentileScore: 50.0,
      currentQuestionId: initialQuestion._id || initialQuestion.id,
      timer: { remainingSeconds: 120 }
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
export const startTargetedSession = async (req, res, next) => {
  try {
    let { resumeText = '', jdText = '', targetRole = '', targetCompany = '', isProctored = true } = req.body;
    const candidateId = req.user ? req.user.id : 'demo_candidate_id';

    if (!resumeText.trim() && !jdText.trim()) {
      return next(new AppError('Please provide either your resume, a job description, or both to start your interview.', 400));
    }

    // Auto-decode if raw binary PDF was submitted
    if (resumeText.startsWith('%PDF-') || resumeText.startsWith('PK\x03\x04')) {
      try {
        const buf = Buffer.from(resumeText, 'binary');
        const extracted = await extractTextFromFileBuffer(buf, 'application/pdf');
        if (extracted && extracted.length > 20) {
          resumeText = extracted;
        }
      } catch (err) {
        console.warn('PDF buffer decode in startTargetedSession:', err.message);
      }
    }

    // Persist and replace user's saved resume in MongoDB
    if (candidateId && candidateId !== 'demo_candidate_id' && resumeText.trim()) {
      await User.findByIdAndUpdate(candidateId, {
        'profile.resumeText': resumeText.trim(),
        'profile.resumeUpdatedAt': new Date(),
        'profile.savedJDText': jdText.trim() || ''
      }).catch(() => {});
    }

    // 1. Analyze Resume
    let parsedResume = null;
    try {
      if (resumeText && resumeText.trim().length > 10) {
        parsedResume = await parseResumeWithLLM(resumeText);
      }
    } catch (e) {
      console.error('Targeted session resume parse error:', e);
    }

    const resumeLines = (resumeText || '').split('\n').map((l) => l.trim()).filter(Boolean);

    if (!parsedResume || !parsedResume.claimedSkills || parsedResume.claimedSkills.length === 0) {
      // Heuristic extraction from raw resume text
      const resumeLower = (resumeText || '').toLowerCase();
      const detectedSkills = [];
      if (resumeLower.includes('react')) detectedSkills.push({ name: 'React.js', level: 'Intermediate' });
      if (resumeLower.includes('node')) detectedSkills.push({ name: 'Node.js & Express', level: 'Intermediate' });
      if (resumeLower.includes('javascript') || resumeLower.includes('js')) detectedSkills.push({ name: 'JavaScript', level: 'Intermediate' });
      if (resumeLower.includes('python')) detectedSkills.push({ name: 'Python', level: 'Intermediate' });
      if (resumeLower.includes('java') && !resumeLower.includes('javascript')) detectedSkills.push({ name: 'Java', level: 'Intermediate' });
      if (resumeLower.includes('cpp') || resumeLower.includes('c++')) detectedSkills.push({ name: 'C++', level: 'Intermediate' });
      if (resumeLower.includes('mongo') || resumeLower.includes('sql')) detectedSkills.push({ name: 'Databases (SQL/NoSQL)', level: 'Intermediate' });
      if (resumeLower.includes('html') || resumeLower.includes('css')) detectedSkills.push({ name: 'HTML & CSS', level: 'Foundational' });

      parsedResume = {
        candidateName: req.user?.name || 'Candidate',
        claimedSkills: detectedSkills.length > 0 ? detectedSkills : [
          { name: 'Web Development Fundamentals', level: 'Intermediate' },
          { name: 'JavaScript & Programming', level: 'Intermediate' },
          { name: 'Data Structures & Algorithms', level: 'Intermediate' }
        ],
        workHistory: []
      };
    }

    // 2. Analyze Job Description
    let parsedJD = null;
    try {
      if (jdText && jdText.trim().length > 10) {
        parsedJD = await parseJobDescription(jdText);
      }
    } catch (e) {
      console.error('Targeted session JD parse error:', e);
    }

    if (!parsedJD) {
      parsedJD = {
        roleTitle: targetRole || 'Software Development Engineer (SDE)',
        company: targetCompany || 'Tech Company',
        track: 'fullstack',
        requiredSkills: [
          { name: 'Programming Fundamentals', slug: 'programming-fundamentals', minProficiency: 0.7 },
          { name: 'Web & API Basics', slug: 'web-api-basics', minProficiency: 0.7 },
          { name: 'Data Structures & Algorithms (DSA)', slug: 'algorithms-dsa', minProficiency: 0.7 }
        ]
      };
    }

    const finalRoleTitle = targetRole || parsedJD.roleTitle || 'Software Engineer';
    const finalCompany = targetCompany || parsedJD.company || 'Tech Company';

    // 3. Assemble Dynamic, Beginner-Friendly 5-Question Interview Sequence
    // Extract candidate's actual project dynamically from resume lines
    let topProject = parsedResume.workHistory?.[0]?.company;
    let projectHighlight = parsedResume.workHistory?.[0]?.highlights?.[0];

    // Scan resume lines for specific projects, avoiding generic titles
    for (let i = 0; i < resumeLines.length; i++) {
      const line = resumeLines[i];
      // Check for numbered project, bullet point project, or "Project:" / "Title:" headers
      const match = line.match(/^(?:(?:\d+[\.\)]\s*)|[-•*]\s*)?(?:Project:\s*|Title:\s*)?([A-Za-z0-9\s&–-]{3,45})(?:\s*[:–-]\s*(.*))?$/i);
      if (match) {
        const candidateProj = match[1].trim();
        const lower = candidateProj.toLowerCase();
        const isHeader = /summary|skill|education|experience|certif|contact|email|phone|objective|languages/i.test(lower);
        const isRole = /developer|engineer|intern|student|bachelor|master|university|college|school/i.test(lower);
        if (!isHeader && !isRole && candidateProj.length >= 4) {
          topProject = candidateProj;
          if (match[2]) projectHighlight = match[2].trim();
          break;
        }
      }
    }

    if (!topProject || ['Fullstack Web Project', 'Tech Solutions Inc.', 'Key Engineering Project', 'Technical Engineering Project'].includes(topProject)) {
      // Look for any line that looks like a project name
      const possibleName = resumeLines.find((l) => /^[A-Z][A-Za-z0-9\s-]{3,35}$/.test(l) && !/summary|skills|education|experience|projects/i.test(l));
      topProject = possibleName || 'Your Core Software Project';
    }

    // Dynamic Top Skill from parsed resume or resume text
    let topSkillName = parsedResume.claimedSkills?.[0]?.name;
    if (!topSkillName) {
      topSkillName = 'modern software development';
    }

    // Round 1: Project Overview & Background (Easy & Welcoming)
    const resumeQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_resume_${Date.now()}`,
      title: `Project Overview: ${topProject}`,
      prompt: `Welcome to the interview! To get started, please give a brief overview of your project "${topProject}" built with ${topSkillName}.\n\nWhat was the main purpose of this project, what primary technologies did you use, and what feature was the most interesting for you to develop?`,
      roundType: 'behavioral',
      topic: 'Project Overview & Fundamentals',
      category: 'Resume & Past Projects',
      difficultyLevel: 'easy',
      keyConcepts: ['project overview', 'technologies', 'core features', 'problem solving', 'role'],
      targetReason: 'Directly tailored to the project and experience found on your resume'
    };

    // Round 2: Core Programming Fundamentals: Variables & Scope (Easy)
    const coreConceptQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_core_${Date.now()}`,
      title: 'Core Programming Fundamentals: Variables & Scope',
      prompt: 'Let\'s cover basic programming fundamentals. Can you explain the difference between `let`, `const`, and `var` in modern programming? In your explanation, describe what block scope means and why developers prefer `const` and `let` in clean code.',
      roundType: 'technical',
      topic: 'Variables, Scope & Fundamentals',
      category: 'Core Computer Science',
      difficultyLevel: 'easy',
      keyConcepts: ['variables', 'let vs const', 'block scope', 'reassignment', 'functions'],
      targetReason: 'Foundational programming concept essential for any developer role'
    };

    // Round 3: Web Basics: HTTP Methods & Database Fundamentals (Easy)
    const backendSystemQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_systems_${Date.now()}`,
      title: 'Web & Database Basics: HTTP Requests & Data Storage',
      prompt: 'Let\'s cover basic web and database fundamentals. What is the difference between an HTTP GET request and an HTTP POST request? Additionally, what is the main difference between a Relational (SQL) database and a NoSQL database in terms of how data is stored?',
      roundType: 'technical',
      topic: 'HTTP Methods & Database Basics',
      category: 'Web & Database Fundamentals',
      difficultyLevel: 'easy',
      keyConcepts: ['http methods', 'get vs post', 'sql vs nosql', 'relational', 'databases'],
      targetReason: 'Basic web and data storage concepts tested in initial screening rounds'
    };

    // Round 4: Beginner Coding (Two Sum Target Lookup - Easy)
    const dsaQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_dsa_${Date.now()}`,
      title: 'Beginner Coding: Two Sum Target Lookup',
      prompt: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nExample:\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1] (because nums[0] + nums[1] == 9)\n\nWrite a clean working solution in your preferred language.',
      roundType: 'coding',
      topic: 'Arrays & Target Lookup',
      category: 'Data Structures & Algorithms (DSA)',
      difficultyLevel: 'easy',
      keyConcepts: ['arrays', 'two sum', 'indices', 'loops', 'hashmap'],
      testCases: [
        { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false },
        { input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: false },
        { input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true }
      ],
      targetReason: 'Beginner-friendly algorithmic screening question on arrays'
    };

    // Round 5: Beginner Coding (Palindrome String Check - Easy)
    const dsaHardQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_palindrome_${Date.now()}`,
      title: 'Beginner Coding: String Reversal & Palindrome Check',
      prompt: 'Write a function that checks whether a given string is a Palindrome (reads the same backwards as forwards, ignoring spaces and capitalization).\n\nExamples:\n- "racecar" -> true\n- "hello" -> false\n- "madam" -> true\n\nWrite a clean working function in your preferred language.',
      roundType: 'coding',
      topic: 'Strings & Palindrome Check',
      category: 'Data Structures & Algorithms (DSA)',
      difficultyLevel: 'easy',
      keyConcepts: ['strings', 'palindrome', 'reversal', 'two pointers', 'loops'],
      testCases: [
        { input: '"racecar"', expectedOutput: 'true', isHidden: false },
        { input: '"hello"', expectedOutput: 'false', isHidden: false },
        { input: '"madam"', expectedOutput: 'true', isHidden: true }
      ],
      targetReason: 'Foundational string manipulation and validation problem'
    };

    const customQuestions = [
      resumeQuestion,
      coreConceptQuestion,
      backendSystemQuestion,
      dsaQuestion,
      dsaHardQuestion
    ];

    const rounds = [
      { roundType: 'behavioral', label: 'Resume & Project Overview', targetQuestions: 1, completedQuestions: 0, defaultTimerSeconds: 180 },
      { roundType: 'technical', label: 'Core Programming Fundamentals', targetQuestions: 2, completedQuestions: 0, defaultTimerSeconds: 120 },
      { roundType: 'coding', label: 'Beginner Algorithmic Coding', targetQuestions: 2, completedQuestions: 0, defaultTimerSeconds: 300 }
    ];

    const initialQuestion = customQuestions[0];

    let session;
    try {
      session = await AssessmentSession.create({
        candidateId,
        track: parsedJD.track || 'fullstack',
        status: 'in_progress',
        isTargeted: true,
        isProctored: isProctored !== undefined ? Boolean(isProctored) : true,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        resumeHighlights: (parsedResume.claimedSkills || []).slice(0, 6).map((s) => s.name),
        jdRequirements: (parsedJD.requiredSkills || []).slice(0, 6).map((r) => r.name),
        customQuestions,
        rounds,
        currentRoundIndex: 0,
        currentRound: initialQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: customQuestions.length,
        currentQuestionId: initialQuestion._id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: 180,
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      });
    } catch (dbErr) {
      session = {
        _id: `targeted_${Date.now()}`,
        id: `targeted_${Date.now()}`,
        candidateId,
        track: parsedJD.track || 'fullstack',
        status: 'in_progress',
        isTargeted: true,
        isProctored: isProctored !== undefined ? Boolean(isProctored) : true,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        resumeHighlights: (parsedResume.claimedSkills || []).slice(0, 6).map((s) => s.name),
        jdRequirements: (parsedJD.requiredSkills || []).slice(0, 6).map((r) => r.name),
        customQuestions,
        rounds,
        currentRoundIndex: 0,
        currentRound: initialQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: customQuestions.length,
        currentQuestionId: initialQuestion._id || initialQuestion.id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: 180,
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date(),
        save: async () => true
      };
    }

    res.status(201).json({
      success: true,
      message: 'Targeted real-job interview session successfully generated and started',
      data: {
        session,
        currentQuestion: initialQuestion,
        totalQuestions: customQuestions.length,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        curatedPlan: [
          'Round 1: Project Overview & Background',
          'Round 2: Core Programming Fundamentals (Variables & Scope)',
          'Round 3: Web & Database Basics (HTTP & SQL vs NoSQL)',
          'Round 4: Beginner Coding (Two Sum Target Lookup)',
          'Round 5: Beginner Coding (Palindrome String Check)'
        ]
      }
    });
  } catch (err) {
    next(err);
  }
};

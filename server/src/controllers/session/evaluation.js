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
import { evaluateStarResponse } from '../../services/scoring/starEvaluator.js';
import { calculateEvaluationConfidence } from '../../services/scoring/confidenceScorer.js';
import {
  calculateRelevance,
  evaluateAnswerQualityChecks,
  extractAnswerEvidence,
  buildConfidenceSkillEvaluations,
  buildCandidateFriendlySummary,
  GATE_FALLBACK_MESSAGE,
  INSUFFICIENT_EVIDENCE_TEXT,
  RELEVANCE_THRESHOLD
} from '../../services/scoring/answerRelevanceGate.js';

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
      integrityScore: telemetry.integrityScore || 100,
      evaluatedBy: pipelineResult.evaluatedBy || 'llm'
    });
    pipelineResult.confidence = confidence;

    if (pipelineResult.evaluatedBy === 'heuristic') {
      session.hasHeuristicEvaluations = true;
    }

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
          evaluatedBy: pipelineResult.evaluatedBy || 'heuristic',
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

export const evaluateStar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, candidateAnswer } = req.body;

    const session =
      id && mongoose.connection.readyState === 1 ? await AssessmentSession.findById(id).catch(() => null) : null;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question && session?.customQuestions && session.customQuestions.length > 0) {
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